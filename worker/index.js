/**
 * Litmus on Cloudflare Workers.
 *
 *   fetch()     — static assets are served by the [assets] binding; this
 *                 handler only sees requests the asset router didn't match.
 *   scheduled() — the reminder dispatcher, run by the cron trigger in
 *                 wrangler.toml every 15 minutes.
 */
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from './webpush.js';

const RUNWAY = {
  group: { light: 2, medium: 4, heavy: 10 },
  individual: { light: 3, medium: 7, heavy: 14 },
};
const WINDOW_MINUTES = 15;
const CLASS_LEAD_MINUTES = 30;

/** Wall-clock date and minutes-since-midnight in a given IANA timezone. */
function localNow(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(hour) * 60 + Number(get('minute')),
  };
}

const toMinutes = (time) => {
  const [h, m] = String(time).split(':');
  return Number(h) * 60 + Number(m);
};

const addDays = (iso, n) => {
  const x = new Date(`${iso}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/**
 * Build the list of notifications owed right now.
 * Pure apart from the Supabase reads, so it's straightforward to reason about.
 */
async function buildQueue(db) {
  const { data: subs, error } = await db.from('push_subscriptions').select('*');
  if (error) throw error;
  if (!subs.length) return { queue: [], subsByUser: new Map() };

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const subsByUser = new Map();
  subs.forEach((s) => {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
    subsByUser.get(s.user_id).push(s);
  });

  const [profilesRes, latestClassRes, habitsRes, logsRes, asgRes, pickedRes] = await Promise.all([
    db.from('profiles').select('*').in('user_id', userIds),
    db.from('imports').select('created_at').eq('kind', 'class').order('created_at', { ascending: false }).limit(1),
    db.from('habits').select('*').in('user_id', userIds),
    db.from('habit_logs').select('user_id,habit_id,date').in('user_id', userIds),
    db.from('assignments').select('id,user_id,title,due,intensity,type,runway_days').in('user_id', userIds),
    db.from('selected_courses').select('user_id,course_key').in('user_id', userIds),
  ]);

  const profiles = profilesRes.data || [];
  const latestClassAt = latestClassRes.data?.[0]?.created_at || null;
  const habits = habitsRes.data || [];
  const logs = logsRes.data || [];
  const assignments = asgRes.data || [];
  const picked = pickedRes.data || [];

  // Selections are stored by course KEY (migration 003) — resolve keys to
  // course rows first, then load those courses' sessions.
  const courseKeys = [...new Set(picked.map((p) => p.course_key))];
  let sessions = [];
  let courses = [];
  if (courseKeys.length) {
    const courseRes = await db.from('courses').select('id,key,name').in('key', courseKeys);
    courses = courseRes.data || [];
    const ids = courses.map((c) => c.id);
    if (ids.length) {
      const sessRes = await db.from('sessions').select('*').in('course_id', ids);
      sessions = sessRes.data || [];
    }
  }
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const pickedByUser = new Map();
  picked.forEach((p) => {
    if (!pickedByUser.has(p.user_id)) pickedByUser.set(p.user_id, new Set());
    pickedByUser.get(p.user_id).add(p.course_key);
  });

  const queue = [];

  for (const profile of profiles) {
    const uid = profile.user_id;
    let now;
    try {
      now = localNow(profile.timezone || 'Asia/Kolkata');
    } catch {
      now = localNow('UTC');
    }

    // ---- habits ------------------------------------------------------
    if (profile.habit_remind) {
      const delta = now.minutes - toMinutes(profile.habit_remind_time);
      if (delta >= 0 && delta < WINDOW_MINUTES) {
        // Same quota rule the app scores and sorts by: a habit is only
        // nagged about while its period quota is unmet. Periods are the
        // user's local day, Mon–Sun week, and calendar month.
        const QUOTA = { daily: 1, twice_week: 2, thrice_week: 3, weekly: 1, monthly: 1 };
        const dow = (new Date(`${now.date}T12:00:00Z`).getUTCDay() + 6) % 7;
        const weekStart = addDays(now.date, -dow);
        const monthStart = `${now.date.slice(0, 8)}01`;
        const periodStart = (freq) =>
          freq === 'daily' ? now.date : freq === 'monthly' ? monthStart : weekStart;

        const mine = habits.filter((h) => h.user_id === uid && h.notif);
        const countByHabit = new Map();
        logs
          .filter((l) => l.user_id === uid)
          .forEach((l) => {
            const habit = mine.find((h) => h.id === l.habit_id);
            if (!habit) return;
            if (l.date >= periodStart(habit.freq) && l.date <= now.date) {
              countByHabit.set(l.habit_id, (countByHabit.get(l.habit_id) || 0) + 1);
            }
          });
        const open = mine.filter((h) => (countByHabit.get(h.id) || 0) < (QUOTA[h.freq] || 1));
        if (open.length) {
          const names = open.slice(0, 3).map((h) => h.name).join(', ');
          const extra = open.length > 3 ? ` and ${open.length - 3} more` : '';
          queue.push({
            userId: uid,
            kind: 'habit',
            ref: 'daily',
            slot: now.date,
            payload: {
              title: `${open.length} habit${open.length > 1 ? 's' : ''} still open`,
              body: `${names}${extra}. Check in to keep your streak.`,
              tag: 'habits',
              url: '/',
            },
          });
        }
      }
    }

    // ---- classes -----------------------------------------------------
    if (profile.class_remind) {
      const mine = pickedByUser.get(uid);
      if (mine?.size) {
        for (const s of sessions) {
          const course = courseById.get(s.course_id);
          if (!course || !mine.has(course.key) || s.iso !== now.date) continue;
          const delta = now.minutes - (toMinutes(s.start) - CLASS_LEAD_MINUTES);
          if (delta < 0 || delta >= WINDOW_MINUTES) continue;
          queue.push({
            userId: uid,
            kind: 'class',
            ref: s.id,
            slot: now.date,
            payload: {
              title: `${course?.key || 'Class'} in 30 minutes`,
              body: `${course?.name || 'Your class'} · ${String(s.start).slice(0, 5)}${
                s.room ? ` · ${s.room}` : ''
              }`,
              tag: `class-${s.id}`,
              url: '/',
            },
          });
        }
      }
    }

    // ---- assignment runways -----------------------------------------
    if (profile.asg_remind && now.minutes >= 480 && now.minutes < 480 + WINDOW_MINUTES) {
      for (const a of assignments.filter((x) => x.user_id === uid)) {
        const runway = a.runway_days ?? RUNWAY[a.type]?.[a.intensity] ?? 7;
        if (addDays(a.due, -runway) !== now.date) continue;
        queue.push({
          userId: uid,
          kind: 'assignment',
          ref: a.id,
          slot: now.date,
          payload: {
            title: 'Runway opens today',
            body: `“${a.title}” is due in ${runway} days — time to start this ${a.type} ${a.intensity} one.`,
            tag: `asg-${a.id}`,
            url: '/',
          },
        });
      }
    }
  }

  return { queue, subsByUser };
}

async function dispatch(env) {
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const vapid = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
  };

  const { queue, subsByUser } = await buildQueue(db);

  let sent = 0;
  let skipped = 0;
  const expired = [];

  for (const item of queue) {
    // Claim the slot first — the unique constraint is what makes a repeat
    // impossible if a run overlaps or retries.
    const { error: claimErr } = await db.from('reminders_sent').insert({
      user_id: item.userId,
      kind: item.kind,
      ref: String(item.ref),
      slot: item.slot,
    });
    if (claimErr) {
      if (claimErr.code === '23505') skipped++;
      else console.error('ledger write failed', claimErr);
      continue;
    }

    const targets = subsByUser.get(item.userId) || [];
    await Promise.all(
      targets.map(async (sub) => {
        try {
          const { ok, status } = await sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            JSON.stringify(item.payload),
            vapid
          );
          if (ok) sent++;
          else if (status === 404 || status === 410) expired.push(sub.endpoint);
          else console.error('push rejected', status, sub.endpoint.slice(0, 60));
        } catch (err) {
          console.error('push failed', err.message);
        }
      })
    );
  }

  if (expired.length) await db.from('push_subscriptions').delete().in('endpoint', expired);

  const summary = { queued: queue.length, sent, skipped, pruned: expired.length };
  console.log('reminders', JSON.stringify(summary));
  return summary;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Manual trigger for testing the dispatcher without waiting for cron.
    // Protected by a shared secret so it isn't a public endpoint.
    if (url.pathname === '/__run-reminders') {
      if (!env.REMINDER_TEST_KEY || url.searchParams.get('key') !== env.REMINDER_TEST_KEY) {
        return new Response('Not found', { status: 404 });
      }
      try {
        const summary = await dispatch(env);
        return Response.json(summary);
      } catch (err) {
        return new Response(err.message, { status: 500 });
      }
    }

    // Share-target POSTs are meant for the service worker; if one reaches
    // the edge (SW not yet controlling), land the user in the app rather
    // than showing a 405.
    if (request.method === 'POST' && url.pathname === '/share-file') {
      return Response.redirect(new URL('/', request.url).toString(), 303);
    }

    // Everything else falls through to the static assets binding.
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      dispatch(env).catch((err) => console.error('reminder run failed', err))
    );
  },
};
