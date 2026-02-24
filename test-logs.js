import fetch from 'node-fetch';
const apiKey = process.env.INTERCOM_API_KEY;
async function test() {
  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json', 'Intercom-Version': 'Unstable' };
  const res = await fetch(`https://api.intercom.io/admins/activity_logs?per_page=100&page=1`, { headers });
  const data = await res.json();
  const changes = data.activity_logs.filter(l => l.activity_type === 'admin_away_mode_change');
  console.log('Total logs:', data.activity_logs.length, 'Away changes:', changes.length);
  if (changes.length > 0) {
    console.log(changes[0].metadata);
  }
}
test();
