import { AppState } from './state.js';
import { supabaseClient } from './db.js';

export const LoggerController = {
  logActivity: async function(actionType, logMessage) {
    if (!AppState.user.ownerId) return;
    
    await supabaseClient.from('activity_logs').insert([{ 
      user_id: AppState.user.ownerId, 
      user_email: AppState.user.email || 'User', // Fallback
      action: actionType, 
      message: logMessage 
    }]);
    
    this.fetchAndDisplayLogs(); 
  },

  fetchAndDisplayLogs: async function() {
    const logContainer = document.getElementById('activityLogList');
    if (!logContainer || !AppState.user.ownerId) return;
    
    const { data, error } = await supabaseClient
      .from('activity_logs')
      .select('*')
      .eq('user_id', AppState.user.ownerId) 
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error || !data || data.length === 0) {
      logContainer.innerHTML = '<p class="empty-msg">No recent activity.</p>';
      return;
    }

    let html = '';
    data.forEach(log => {
      const dateObj = new Date(log.created_at);
      const timeString = dateObj.toLocaleDateString() + ' at ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const icon = log.action === 'ADDED' ? '🟢' : '🔴';
      // Basic sanitization
      const safeEmail = log.user_email ? log.user_email.replace(/</g, "&lt;") : 'Unknown User';
      const safeMessage = log.message ? log.message.replace(/</g, "&lt;") : '';
      
      html += `<div class="log-item"><span class="log-icon">${icon}</span><div><strong>${log.action} by ${safeEmail}:</strong> ${safeMessage}<span class="log-time">${timeString}</span></div></div>`;
    });
    logContainer.innerHTML = html;
  }
};