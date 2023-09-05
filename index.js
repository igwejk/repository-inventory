#!/usr/bin/env node

import { Octokit } from "octokit";
import { open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from "node:path";

/**
 * GraphQL query to retrieve organizations in a GitHub enterprise account.
 */
const queryEnterpriseOrganizations = `
    query organizationsInEnterprise($slug: String!, $pageSize: Int!, $cursor: String) {
        enterprise(slug: $slug) {
            organizations(first: $pageSize, after: $cursor) {
                pageInfo {
                    endCursor
                    hasNextPage
                }
                nodes {
                    ... on Organization {
                        login
                    }
                }
            }
        }
    }
`;

/**
 * GraphQL query to retrieve repositories for a given organization in a GitHub enterprise account.
 */
const queryOrganizationRepositories = `
query repositoriesInOrganization($login: String!, $pageSize: Int!, $cursor: String) {
    organization(login: $login) {
        name
        login
        repositories(
            first: $pageSize
            after: $cursor
            orderBy: { field: NAME, direction: ASC }
        ) {
            totalCount
            totalDiskUsage
            pageInfo {
                endCursor
                hasNextPage
            }
            nodes {
                ... on Repository {
                    branches: refs(refPrefix: "refs/heads/") {
                        totalCount
                    }
                    branchProtectionRules {
                        totalCount
                    }
                    commitComments {
                        totalCount
                    }
                    collaborators {
                        totalCount
                    }
                    diskUsage
                    discussions {
                        totalCount
                    }
                    hasWikiEnabled
                    isEmpty
                    isFork
                    issues {
                        totalCount
                    }
                    milestones {
                        totalCount
                    }
                    name
                    owner {
                        login
                    }
                    projects {
                        totalCount
                    }
                    pullRequests {
                        totalCount
                    }
                    pushedAt
                    releases {
                        totalCount
                    }
                    tags: refs(refPrefix: "refs/tags/") {
                        totalCount
                    }
                    updatedAt
                    url
                    isArchived
                    isTemplate
                    languages(first: $pageSize) {
                        nodes {
                            ... on Language {
                                name
                            }
                        }
                    }
                    primaryLanguage {
                        name
                    }
                    object(expression: "HEAD") {
                        ... on Commit {
                            authors(first: $pageSize) {
                                nodes {
                                    ... on GitActor {
                                        name
                                        email
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
`;




/**
 * Asynchronously gets all organisations in the specified enterprise.
 * @async
 * @generator
 * @function getAllOrgsInEnterprise
 * @param {Object} octokit - The oktokit object.
 * @param {string} slug - The slug of the enterprise to query.
 * @yields {Promise<Object[]>} - An array of organisation data
 * @throws {Error} - If an error occurs while querying the GitHub API.
 */
async function getAllOrgsInEnterprise({ octokit, slug }) {
    console.debug(`Getting organizations for enterprise: ${slug}`)
    const result =
        await getAllOrgsInEnterpriseRecursive({
            octokit,
            slug
        }
        )
    return result.enterprise.organizations.nodes
}

/**
 * Asynchronously gets all organisations in the specified enterprise.
 * @async
 * @generator
 * @function getAllOrgsInEnterpriseRecursive
 * @param {Object} octokit - The oktokit object.
 * @param {string} slug - The slug of the organization to query.
 * @param {Object[]} accumulator - Accumulation of organisation nodes as pages are looped.
 * @return {Promise<Object[]>} - An array of repositories data
 * @throws {Error} - If an error occurs while querying the GitHub API.
 */
async function getAllOrgsInEnterpriseRecursive({ octokit, slug, accumulator }) {
    if (
        accumulator &&
        !accumulator.enterprise.organizations.pageInfo.hasNextPage
    )
        return accumulator

    const start =
        accumulator?.enterprise.organizations.pageInfo.endCursor ?? null

    const result =
        await octokit.graphql(queryEnterpriseOrganizations, {
            slug,
            cursor: start,
            pageSize: 100,
        })

    if (accumulator) {
        console.debug(`  - Accumulating organizations from next page`)
        result.enterprise.organizations.nodes.push(
            ...accumulator.enterprise.organizations.nodes
        )
    }
    return await getAllOrgsInEnterpriseRecursive({
        octokit,
        slug,
        accumulator: result
    }
    )
}



/**
 * Asynchronously gets all repositories in the specified organization.
 * @async
 * @generator
 * @function getAllReposInOrg
 * @param {Object} octokit - The oktokit object.
 * @param {string} organization - The slug of the organization to query.
 * @yields {Promise<Object[]>} - An array of repositories data
 * @throws {Error} - If an error occurs while querying the GitHub API.
 */
async function getAllReposInOrg({ octokit, login }) {
    console.debug(`Getting repositories for organization: ${login}`)
    const result =
        await getAllReposInOrgRecursive({
            octokit,
            login
        }
        )
    return result.organization.repositories.nodes
}

/**
 * Asynchronously gets all repositories in the specified organization.
 * @async
 * @generator
 * @function getAllReposInOrgRecursive
 * @param {Object} octokit - The oktokit object.
 * @param {string} organization - The slug of the organization to query.
 * @param {Object[]} accumulator - Accumulation of repository nodes as pages are looped.
 * @return {Promise<Object[]>} - An array of repositories data
 * @throws {Error} - If an error occurs while querying the GitHub API.
 */
async function getAllReposInOrgRecursive({ octokit, login, accumulator }) {
    if (
        accumulator &&
        !accumulator.organization.repositories.pageInfo.hasNextPage
    )
        return accumulator

    const start =
        accumulator?.organization.repositories.pageInfo.endCursor ?? null

    const result =
        await octokit.graphql(queryOrganizationRepositories, {
            login,
            cursor: start,
            pageSize: 100,
        })

    if (accumulator) {
        console.debug(`  - Accumulating repositories from next page`)
        result.organization.repositories.nodes.push(
            ...accumulator.organization.repositories.nodes
        )
    }
    return await getAllReposInOrgRecursive({
        octokit,
        login,
        accumulator: result
    }
    )
}

/**
 * Asynchronously generates a CSV row of repository data for all repositories in the specified enterprise.
 * @async
 * @generator
 * @function generateRepositories
 * @param {Object} param - The parameter object.
 * @param {string} param.enterpriseSlug - The slug of the enterprise to query.
 * @param {Object} param.octokit - The authenticated Octokit instance to use for querying the GitHub API.
 * @yields {string} - A CSV string representing a header or repository data row.
 * @throws {Error} - If an error occurs while querying the GitHub API.
 */
async function* generateRepositories({ enterpriseSlug: slug, octokit } = {}) {
    yield [
        'Name',
        'Organization',
        'URL',
        'Branches (#)',
        'Branch Protection Rules (#)',
        'Commit Comments (#)',
        'Collaborators (#)',
        'Disk Usage (KB)',
        'Discussions (#)',
        'Has Wiki Enabled?',
        'Is Empty?',
        'Is Fork?',
        'Issues (#)',
        'Milestones (#)',
        'Projects (#)',
        'Pull Requests (#)',
        'Pushed At',
        'Releases (#)',
        'Tags (#)',
        'Updated At',
        'Is Archived?',
        'Is Template?',
        'Languages',
        'Primary Language',
        'Authors'
    ].join(',') + '\n';

    const organizations = await getAllOrgsInEnterprise({ octokit, slug: slug })

    for (const organization of organizations) {
        const repositories = await getAllReposInOrg({ octokit, login: organization.login })
        if (repositories.length === 0) {
            continue;
        }
        yield* repositories.map(repository => {
            return [
                repository.name,
                repository.owner.login,
                repository.url,
                repository.branches.totalCount,
                repository.branchProtectionRules.totalCount,
                repository.commitComments.totalCount,
                repository.collaborators.totalCount,
                repository.diskUsage,
                repository.discussions.totalCount,
                repository.hasWikiEnabled,
                repository.isEmpty,
                repository.isFork,
                repository.issues.totalCount,
                repository.milestones.totalCount,
                repository.projects.totalCount,
                repository.pullRequests.totalCount,
                repository.pushedAt,
                repository.releases.totalCount,
                repository.tags.totalCount,
                repository.updatedAt,
                repository.isArchived,
                repository.isTemplate,
                repository.languages.nodes.map(language => language.name).join('::'),
                repository.primaryLanguage?.name,
                repository.object?.authors.nodes.map(author => `${author.name} <${author.email}>`).join('::'),
            ].join(',') + '\n';
        });
    }
}

(async () => {

    let outputFileHandle;
    const outputFilePath = process.env.REPOSITORY_INVENTORY ||
        path.join(process.cwd(), `repository-inventory-${Date.now()}.csv`);

    try {
        outputFileHandle = await open(outputFilePath, 'w');

        await pipeline(
            Readable.from(
                generateRepositories({
                    octokit: new Octokit({
                        auth: process.env.GITHUB_TOKEN,
                        baseUrl: `https://${process.env.GITHUB_HOST}/api/v3`
                    }),
                    enterpriseSlug: process.env.GITHUB_ENTERPRISE_SLUG || 'github'
                })
            ),
            outputFileHandle.createWriteStream(),
        );
    } finally {
        await outputFileHandle?.close();
        console.info(`Wrote repository inventory to ${outputFilePath}`);
    }
})();