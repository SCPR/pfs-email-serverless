'use strict';

const _  = require('underscore');
const fs = require('fs');
const YAML = require('js-yaml');
const AWS = require('aws-sdk');
const mongodb = require('mongodb');
const postmark = require('postmark');

let mailClient;
let sentEmails = 0;
const secretPath = './secrets';
const kms = new AWS.KMS({region: 'us-west-2'});
const encryptedSecret = fs.readFileSync(secretPath);
const MongoClient = mongodb.MongoClient;

const kmsParams = {
  CiphertextBlob: encryptedSecret
};
const emailSubject = 'Welcome to KPCC Plus!';
const startingTime = new Date().getTime();

module.exports.sendEmails = () => {
  new Promise((resolve, reject) => {
    kms.decrypt(kmsParams, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  }).then((data) => {
    const secrets = YAML.safeLoad(data['Plaintext'].toString());
    mailClient = new postmark.Client(secrets.postmarkKey);

    return new Promise((resolve, reject) => {
      MongoClient.connect(secrets.mongoDbUri, (err, db) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  })
    .then((db) => {
      const collection = db.collection('PfsUser');
      collection.find({emailSent: { $ne: true }}).toArray((err, results) => {
        if (err) {
          console.log(err);
        }  else if (results.length) {
          _.each(results, (result) => {
            const sendIndividualEmailCallback = {
              success: () => {
                collection.updateOne(
                  { "_id": result._id },
                  {$set: { emailSent: true }}
                );
                handleResult();
              },
              error: (error) => {
                console.log(error);
                handleResult();
              }
            };
            sendIndividualEmail(result, sendIndividualEmailCallback);
          });
          const handleResult = _.after(results.length, () => {
            const elapsedTime = new Date().getTime() - startingTime;
            console.log(`Attempted to send ${results.length} emails in ${elapsedTime}ms`);
            console.log(`Successfully sent ${sentEmails} emails`);
            db.close();
          });
        } else {
          console.log('No users to email');
          db.close();
        }
      });
    })
    .catch((err) => {
      console.log(err);
    });
};


function sendIndividualEmail(userObject, callback) {

  const emailBody = `Dear ${userObject.firstName}, <br/><p>Congratulations! You can now stream KPCC on your computer 
or mobile device during our member drives - without any fundraising interruptions.</p><p>The fundraising-free stream 
KPCC Plus is easy to access. Click or paste this link to listen on your desktop or mobile web browser: 
http://www.scpr.org/listen_live/pledge-free?pledgeToken=${userObject.pledgeToken}</p><p>You can also access 
KPCC Plus directly through our iPhone App. Launch the app, and tap on KPCC Live in the orange navbar at the top of the 
screen. Choose the KPCC Plus stream from the menu, and type this code:${userObject.pledgeToken}</p>
<p>Thanks again for your generous support! Your contribution will go right back into the balanced coverage and inspiring
 stories you love.</p><p></br><br/>Sincerely, <br/>Rob Risko</p><p>P.S. Having trouble accessing KPCC Plus? Call us at
  626-583-5121 or visit our FAQ page: http://www.kpcc.org/plus</p>`;

  const email = 'louise.yang@scpr.org'; // TODO: deploy to prod with: userObject.email;
  mailClient.sendEmail({
    To: email,
    From: 'Rob Risko <membership@kpcc.org>',
    Subject: emailSubject,
    HtmlBody: emailBody
  }, (error, success) => {
      if (error) {
        console.error(error.message);
        callback.error('Failed to send an email');
        return;
      }
      console.log('Email sent to ' + email);
      sentEmails = sentEmails + 1;
      callback.success(true);
    }
  );
};