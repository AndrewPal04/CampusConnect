const fetch = require('node-fetch');

const pool = require('../db');

async function sendPush(userId, payload = {}) {
  if (!userId) {
    return;
  }

  try {
    const tokenResult = await pool.query(
      `
        SELECT push_token
        FROM users
        WHERE id = $1
      `,
      [userId]
    );

    const pushToken = tokenResult.rows[0]?.push_token;
    if (!pushToken) {
      return;
    }

    const pushPayload = {
      to: pushToken,
      title: payload.title || 'CampusConnect',
      body: payload.body || '',
      data: payload.data || {},
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushPayload),
    });

    const responseText = await response.text();
    let responsePayload = null;

    if (responseText) {
      try {
        responsePayload = JSON.parse(responseText);
      } catch (error) {
        responsePayload = responseText;
      }
    }

    if (!response.ok) {
      console.warn('Expo push request failed:', {
        userId,
        status: response.status,
        response: responsePayload,
      });
      return;
    }

    console.log('Expo push sent:', { userId, response: responsePayload });
  } catch (error) {
    console.warn('Expo push delivery error:', error?.message || error);
  }
}

module.exports = {
  sendPush,
};
