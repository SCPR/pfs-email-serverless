'use strict';

const _ = require('underscore');
const fs = require('fs');
const YAML = require('js-yaml');
const AWS = require('aws-sdk');
const mongodb = require('mongodb');
const postmark = require('postmark');
const moment = require('moment');

let mailClient;
let prod = false;
let sentEmails = 0;
const driveStart = 'kpccPlusDriveStart';
const driveEnd = 'kpccPlusDriveEnd';
const secretPath = './secrets';
const kms = new AWS.KMS({ region: 'us-west-2' });
const encryptedSecret = fs.readFileSync(secretPath);
const MongoClient = mongodb.MongoClient;

const kmsParams = {
  CiphertextBlob: encryptedSecret,
};
const emailSubject = 'Welcome to KPCC Plus!';
const startingTime = new Date().getTime();


function driveTimePromise(db) {
  const collection = db.collection('iPhoneSettings');
  return new Promise((resolve) => {
    collection.find({ settingName: { $in: [driveStart, driveEnd] } }).toArray((err, results) => {
      let driveStartTimestamp;
      let driveEndTimestamp;
      _.each(results, (setting) => {
        if (setting.settingName === driveStart) {
          driveStartTimestamp = setting.settingValue;
        } else if (setting.settingName === driveEnd) {
          driveEndTimestamp = setting.settingValue;
        }
      });
      resolve(driveStartTimestamp && driveEndTimestamp
        && moment(driveStartTimestamp).isBefore(startingTime)
        && moment(driveEndTimestamp).isAfter(startingTime));
    });
  });
}

function sendIndividualEmail(userObject, callback) {
  let name = userObject.firstName || userObject.name
  if (!name) {
    name = '';
  }

  const emailBody = `Dear ${name}, <br/><p>Congratulations! You can now stream KPCC on your computer 
or mobile device during our member drives - without any fundraising interruptions.</p><p>The fundraising-free stream 
KPCC Plus is easy to access. Click or paste this link to listen on your desktop or mobile web browser: 
http://www.scpr.org/listen_live/pledge-free?pledgeToken=${userObject.pledgeToken}</p><p>You can also access 
KPCC Plus directly through our iPhone and Android Apps. Launch the app, and tap on KPCC Live in the orange navbar at the top of the 
screen. Choose the KPCC Plus stream from the menu, and type this code: ${userObject.pledgeToken}</p>
<p>Thanks again for your generous support! Your contribution will go right back into the balanced coverage and inspiring
 stories you love.</p><p></br><br/>Sincerely, <br/>Rob Risko</p><p>P.S. Having trouble accessing KPCC Plus? Call us at
  626-583-5121 or visit our FAQ page: http://www.kpcc.org/plus</p>`;

  const email = prod ? userObject.email : 'louise.yang@scpr.org';
  mailClient.sendEmail({
    To: email,
    From: 'Rob Risko <membership@kpcc.org>',
    Subject: emailSubject,
    HtmlBody: emailBody,
  }, (error) => {
    if (error) {
      console.error(error.message);
      callback.error('Failed to send an email');
      return;
    }
    console.log(`Email sent to ${email}`);
    sentEmails += sentEmails + 1;
    callback.success(true);
  });
}

function findMembersToEmail(db) {
  const collection = db.collection('PfsUser');
  collection.find({ emailSent: { $eq: false } }).toArray((err, results) => {
    if (err) {
      console.log(err);
    } else if (results.length) {
      const handleResult = _.after(results.length, () => {
        const elapsedTime = new Date().getTime() - startingTime;
        console.log(`Attempted to send ${results.length} emails in ${elapsedTime}ms`);
        console.log(`Successfully sent ${sentEmails} emails`);
        db.close();
      });

      _.each(results, (result) => {
        const sendIndividualEmailCallback = {
          success: () => {
            if (prod) {
              collection.updateOne(
                { _id: result._id },
                { $set: { emailSent: true } }
              );
            }
            handleResult();
          },
          error: (error) => {
            console.log(error);
            handleResult();
          },
        };
        sendIndividualEmail(result, sendIndividualEmailCallback);
      });
    } else {
      console.log('No users to email');
      db.close();
    }
  });
}

function sendEmails() {
  console.log(`Running sendEmails (in production? ${prod})`);
  new Promise((resolve, reject) => {
    kms.decrypt(kmsParams, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  }).then((data) => {
    const secrets = YAML.safeLoad(data.Plaintext.toString());
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
    driveTimePromise(db).then((driveTime) => {
      if (!driveTime) {
        console.log('Not drive time. Not emailing anyone');
        db.close();
        return;
      }
      findMembersToEmail(db);
    });
  })
  .catch((err) => {
    console.log(err);
  });
}

module.exports.sendEmails_prod = () => {
  prod = true;
  sendEmails();
};

module.exports.sendEmails_dev = () => {
  prod = false;
  sendEmails();
};
