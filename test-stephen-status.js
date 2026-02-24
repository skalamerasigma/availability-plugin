import fetch from 'node-fetch';

async function test() {
  const apiKey = process.env.INTERCOM_API_KEY;
  if (!apiKey) {
    console.log("No API key");
    return;
  }
  
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Accept': 'application/json',
    'Intercom-Version': 'Unstable'
  };

  const adminsRes = await fetch('https://api.intercom.io/admins', { headers });
  const adminsData = await adminsRes.json();
  
  const stephen = adminsData.admins.find(a => a.name.toLowerCase().includes('stephen'));
  if (stephen) {
    console.log("Found Stephen:", stephen.name);
    console.log("- Away mode enabled:", stephen.away_mode_enabled);
    
    // Now fetch specific admin to get reason ID
    const specificRes = await fetch(`https://api.intercom.io/admins/${stephen.id}`, { headers });
    const specificData = await specificRes.json();
    console.log("- Reason ID:", specificData.away_status_reason_id);
    
    if (specificData.away_status_reason_id) {
      const reasonsRes = await fetch('https://api.intercom.io/away_status_reasons', { headers });
      const reasonsData = await reasonsRes.json();
      const reason = reasonsData.data.find(r => String(r.id) === String(specificData.away_status_reason_id));
      console.log("- Reason Text:", reason ? `${reason.emoji} ${reason.label}` : 'Unknown');
    }
  } else {
    console.log("Could not find Stephen");
  }
}

test().catch(console.error);
