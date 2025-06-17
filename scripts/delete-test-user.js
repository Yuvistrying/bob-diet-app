// Script to delete a user from Clerk
// Usage: CLERK_SECRET_KEY=your_secret_key node scripts/delete-test-user.js email@example.com

const https = require('https');

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const email = process.argv[2];

if (!CLERK_SECRET_KEY) {
  console.error('Please provide CLERK_SECRET_KEY as environment variable');
  process.exit(1);
}

if (!email) {
  console.error('Please provide email as argument');
  console.error('Usage: CLERK_SECRET_KEY=sk_test_xxx node scripts/delete-test-user.js email@example.com');
  process.exit(1);
}

// First, find the user by email
const findUserOptions = {
  hostname: 'api.clerk.com',
  path: `/v1/users?email_address=${encodeURIComponent(email)}`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
};

const findReq = https.request(findUserOptions, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const users = JSON.parse(data);
      
      if (!users || users.length === 0) {
        console.log(`No user found with email: ${email}`);
        return;
      }

      const userId = users[0].id;
      console.log(`Found user with ID: ${userId}`);

      // Now delete the user
      const deleteOptions = {
        hostname: 'api.clerk.com',
        path: `/v1/users/${userId}`,
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const deleteReq = https.request(deleteOptions, (deleteRes) => {
        if (deleteRes.statusCode === 200) {
          console.log(`Successfully deleted user: ${email}`);
        } else {
          console.error(`Failed to delete user. Status: ${deleteRes.statusCode}`);
        }
      });

      deleteReq.on('error', (e) => {
        console.error(`Problem with delete request: ${e.message}`);
      });

      deleteReq.end();

    } catch (e) {
      console.error('Error parsing response:', e);
      console.error('Response:', data);
    }
  });
});

findReq.on('error', (e) => {
  console.error(`Problem with find request: ${e.message}`);
});

findReq.end();