# pfs-email-serverless
This is a lambda function created by the serverless framework.  It searches through members in our mongodb who have not been sent emails and sends them an email with their custom token to unlock the pledge free stream.  It then marks those members off as already receiving the email.

The lambda should be triggered every 3 minutes to look for members to email.  AWS CloudWatch Events handles the schedule.

## Requirements

* node
* aws cli
* serverless

## Installation

* check out this repo
* install severless package globally:
    `npm i g serverless`
* install the aws cli and set up your credentials if you haven't done so already (http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html)
* `npm install`

## Running

The lambda runs every 3 minutes during drive time (manually enabled at the start of drive), but if you want to trigger a run:

`serverless invoke --function sendEmails -l`

By default, this will run in 'dev' mode, which will email scprdev@scpr.org instead of the user's real email. Dev mode will also *not* set that user's `emailSent` flag, which makes it easier to run the method again and send an email without having to manually reset that flag.

During drive time, a developer will deploy the 'prod' mode of lambda and attach the 'sendPFSemails_trigger' CloudWatch rule to that lambda so that it will run every 3 minutes.

## Developing

Most of the changes you'll need to make such as copy changes or code changes will be done in `handler.js`.  Once those changes are done, check it into git and type in

`serverless deploy`

to deploy those changes to AWS lambda, which is where the function will run when you do `serverless invoke...`

When you are sure everything is working, deploy it to prod with:

`serverless deploy -s prod`

The prod version will use real users' email addresses and mark them as `emailSent = true` once an email is sent.

## Debugging

To quickly view the logs without having to play the 'click all links' game in the AWS console, you can run:

`serverless logs --function sendEmails`

Typically, if you are not seeing emails, either there are no users who have not been sent the email, or there is an IAM error and
the lambda script can't decrypt any of the secrets or does not have the necessary permissions to read something.