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

`serverless invoke --function sendEmails`

By default, this will run in 'dev' mode, which will email scprdev@scpr.org instead of the user's real email. Dev mode will also *not* set that user's `emailSent` flag, which makes it easier to run the method again and send an email without having to manually reset that flag.

During drive time, a developer will deploy the 'prod' mode of lambda and attach the 'sendPFSemails_trigger' CloudWatch rule to that lambda so that it will run every 3 minutes.
