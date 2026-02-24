import fetch from 'node-fetch';

async function test() {
  const urlOpen = 'http://localhost:8080/api/intercom/conversations/open-team-5480079?skipClosed=true';
  const urlClosed = 'http://localhost:8080/api/intercom/conversations/open-team-5480079?closedOnly=true';
  
  const [resOpen, resClosed] = await Promise.all([
    fetch(urlOpen, { headers: { 'Accept': 'application/json' } }),
    fetch(urlClosed, { headers: { 'Accept': 'application/json' } })
  ]);
  
  const dataOpen = await resOpen.json();
  const dataClosed = await resClosed.json();
  
  const allConvs = [...(dataOpen.conversations || []), ...(dataClosed.conversations || [])];
  const teamMembers = dataOpen.teamMembers || [];
  
  function isToday(timestamp) {
    if (!timestamp) return false;
    const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000;
    const date = new Date(timestampMs);
    const ptFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const todayPT = ptFormatter.format(new Date());
    const datePT = ptFormatter.format(date);
    return todayPT === datePT;
  }
  
  const assignedMap = {};
  
  allConvs.forEach(conv => {
    const adminReplyAt = conv.statistics?.first_admin_reply_at || conv.statistics?.last_admin_reply_at;
    if (isToday(adminReplyAt)) {
      const assigneeId = conv.admin_assignee_id || (conv.admin_assignee && conv.admin_assignee.id);
      if (assigneeId) {
        const member = teamMembers.find(m => String(m.id) === String(assigneeId));
        const name = member ? member.name : String(assigneeId);
        
        if (!assignedMap[name]) assignedMap[name] = new Set();
        assignedMap[name].add(conv.id || conv.conversation_id);
      }
    }
  });
  
  for (const [name, convs] of Object.entries(assignedMap)) {
    console.log(`\n${name} (${convs.size} assigned):`);
    console.log(Array.from(convs).join(', '));
  }
}
test();
