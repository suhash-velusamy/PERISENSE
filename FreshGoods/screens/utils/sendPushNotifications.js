/**
 * Send an Expo push notification
 * token   – Expo push token (starts with ExpoPushToken[...])
 * payload – { title, body, data? }
 */
const axios = require('axios');

async function sendPushNotification(token, payload) {
  try {
    await axios.post('https://exp.host/--/api/v2/push/send', {
      to: token,
      sound: 'default',
      title: payload.title,
      body:  payload.body,
      data:  payload.data || {},
    });
  } catch (err) {
    console.error('Expo push error:', err.response?.data || err.message);
  }
}

module.exports = sendPushNotification;
