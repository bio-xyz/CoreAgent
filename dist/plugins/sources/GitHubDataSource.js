"use strict";
// src/plugins/sources/GitHubDataSource.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubDataSource = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
/**
 * A plugin that fetches GitHub-like data (contributors + summary)
 * from the two specified JSON endpoints and returns ContentItems.
 */
class GitHubDataSource {
    constructor(config) {
        this.name = config.name;
        this.contributorsUrl = config.contributorsUrl;
        this.summaryUrl = config.summaryUrl;
        this.historicalSummaryUrl = config.historicalSummaryUrl;
        this.historicalContributorUrl = config.historicalContributorUrl;
        this.githubCompany = config.githubCompany;
        this.githubRepo = config.githubRepo;
        this.baseGithubUrl = `https://github.com/${this.githubCompany}/${this.githubRepo}/`;
        this.baseGithubImageUrl = `https://opengraph.githubassets.com/1/${this.githubCompany}/${this.githubRepo}/`;
    }
    /**
     * Fetch items from both JSON endpoints and unify them
     * into an array of ContentItem objects.
     */
    async fetchItems() {
        try {
            const targetDate = new Date();
            const contributorsResp = await (0, node_fetch_1.default)(this.contributorsUrl);
            if (!contributorsResp.ok) {
                console.error(`Failed to fetch contributors.json. Status: ${contributorsResp.status}`);
                return [];
            }
            const contributorsData = await contributorsResp.json();
            const summaryResp = await (0, node_fetch_1.default)(this.summaryUrl);
            if (!summaryResp.ok) {
                console.error(`Failed to fetch summary.json. Status: ${summaryResp.status}`);
                return [];
            }
            const summaryData = await summaryResp.json();
            const githubData = await this.processGithubData(contributorsData, summaryData, targetDate);
            return githubData;
        }
        catch (error) {
            console.error("Error fetching GitHub data:", error);
            return [];
        }
    }
    async fetchHistorical(date) {
        try {
            const targetDate = new Date(date);
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getUTCDate()).padStart(2, '0');
            const historicalSummary = this.historicalSummaryUrl.replace("<year>", String(year)).replace("<month>", month).replace("<day>", day);
            const historicalContributor = this.historicalContributorUrl.replace("<year>", String(year)).replace("<month>", month).replace("<day>", day);
            const contributorsResp = await (0, node_fetch_1.default)(historicalContributor);
            let contributorsData = [];
            if (!contributorsResp.ok) {
                console.error(`Failed to fetch contributors.json. Status: ${contributorsResp.status}`);
                contributorsData = [];
            }
            else {
                contributorsData = await contributorsResp.json();
            }
            const summaryResp = await (0, node_fetch_1.default)(historicalSummary);
            let summaryData = [];
            if (!summaryResp.ok) {
                console.error(`Failed to fetch summary.json. Status: ${summaryResp.status}`);
                summaryData = [];
            }
            else {
                summaryData = await summaryResp.json();
            }
            const githubData = await this.processGithubData(contributorsData, summaryData, targetDate);
            return githubData;
        }
        catch (error) {
            console.error("Error fetching GitHub data:", error);
            return [];
        }
    }
    async processGithubData(contributorsData, summaryData, date) {
        try {
            const githubItems = [];
            (Array.isArray(contributorsData)
                ? contributorsData : []).forEach((c) => {
                if (c.activity?.code?.commits?.length > 0) {
                    c.activity?.code?.commits?.forEach((commit) => {
                        const item = {
                            type: "githubCommitContributor",
                            cid: `github-commit-${commit.sha}`,
                            source: this.name,
                            link: `${this.baseGithubUrl}commit/${commit.sha}`,
                            text: commit.message,
                            date: date.getTime() / 1000,
                            metadata: {
                                additions: commit.additions,
                                deletions: commit.deletions,
                                changed_files: commit.changed_files,
                                photos: [`${this.baseGithubImageUrl}commit/${commit.sha}`]
                            },
                        };
                        githubItems.push(item);
                    });
                }
                if (c.activity?.code?.pull_requests?.length > 0) {
                    c.activity?.code?.pull_requests?.forEach((pr) => {
                        const item = {
                            type: "githubPullRequestContributor",
                            cid: `github-pull-${pr.number}`,
                            source: this.name,
                            link: `${this.baseGithubUrl}pull/${pr.number}`,
                            text: `Title: ${pr.title}\nBody: ${pr.body}`,
                            date: date.getTime() / 1000,
                            metadata: {
                                number: pr.number,
                                state: pr.state,
                                merged: pr.merged,
                                photos: [`${this.baseGithubImageUrl}pull/${pr.number}`]
                            },
                        };
                        githubItems.push(item);
                    });
                }
                if (c.activity?.issues?.opened?.length > 0) {
                    c.activity?.issues?.opened?.forEach((issue) => {
                        const item = {
                            type: "githubIssueContributor",
                            cid: `github-issue-${issue.number}`,
                            source: this.name,
                            link: `${this.baseGithubUrl}issues/${issue.number}`,
                            text: `Title: ${issue.title}\nBody: ${issue.body}`,
                            date: date.getTime() / 1000,
                            metadata: {
                                number: issue.number,
                                state: issue.state,
                                photos: [`${this.baseGithubImageUrl}issues/${issue.number}`]
                            },
                        };
                        githubItems.push(item);
                    });
                }
            });
            const cid = `github-contrib-${summaryData.title}`;
            const summaryItem = {
                type: "githubSummary",
                title: summaryData.title,
                cid: cid,
                source: this.name,
                text: summaryData.overview,
                date: date.getTime() / 1000,
                metadata: {
                    metrics: summaryData.metrics,
                    changes: summaryData.changes,
                    areas: summaryData.areas,
                    issues_summary: summaryData.issues_summary,
                    top_contributors: summaryData.top_contributors,
                    questions: summaryData.questions,
                },
            };
            return [...githubItems, summaryItem];
        }
        catch (error) {
            return [];
        }
    }
}
exports.GitHubDataSource = GitHubDataSource;
