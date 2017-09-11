const moment = require('moment');
const metadata = require('probot-metadata');
const GitHubHelper = require('./github-helper');

module.exports = class Freeze {

  constructor(github, config) {
    this.github = github;
    this.config = config;
    this.logger = config.logger || console;
  }

  async freeze(context, props) {
    const labels = context.payload.issue.labels;
    if (GitHubHelper.isLabelOnIssue(
      context.payload.issue,
      this.config.label) === undefined) {
      labels.push(this.config.label);
    }

    const kv = metadata(context.github, context.issue(), process.env.APP_ID);
    await kv.set('snooze', props);

    await this.github.issues.edit(context.issue({
      state: 'closed',
      labels
    }));

    await this.github.issues.createComment(context.issue({
      body: 'Sure thing. I\'ll close this issue for a bit. I\'ll ping you around ' +
      moment(props.when).calendar() + ' :clock1: '
    }));
  }

  async checkUnfreeze(issue) {
    const kv = metadata(this.github, issue, process.env.APP_ID);
    const props = await kv.get('snooze');

    if (moment(props.when) < moment()) {
      return this.unfreeze(issue, props);
    }
  }

  async unfreeze(issue, props) {
    const labels = issue.labels;
    const frozenLabel = labels.find(label => {
      return label.name === this.config.label;
    });
    const pos = labels.indexOf(frozenLabel);
    labels.splice(pos, 1);

    const {owner, repo, number} = issue;

    await this.github.issues.edit({owner, repo, number, labels, state: 'open'});

    await this.github.issues.createComment({
      owner, repo, number,
      body: ':wave: @' + props.who + ', ' + props.what
    });
  }
};
