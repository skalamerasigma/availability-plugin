import fetch from 'node-fetch';

async function test() {
  const url = 'http://localhost:8080/api/intercom/coins/leaderboard';
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test().catch(console.error);
