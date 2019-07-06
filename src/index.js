import path from "path"

import yargs from "yargs"
import fsp from "@absolunet/fsp"
import execa from "execa"
import simpleGit from "simple-git/promise"
import Octokit from "@octokit/rest"
import npmCheckUpdates from "npm-check-updates"
import whichPromise from "which-promise"
import config from "lib/config"
import logger from "lib/logger"
import ensureArray from "ensure-array"
import ms from "ms.macro"
import {isString} from "lodash"

let github
try {
  github = new Octokit({
    auth: {
      clientId: config.githubClientId,
      clientSecret: config.githubClientSecret,
    },
  })
  logger.info("Authenticated for Octokit")
} catch (error) {
  github = new Octokit
  logger.warn("Could not create a GitHub API client with auth options")
  logger.error("GitHub API client creation failed: %s", error)
}

/**
 * @param {Argv} argv
 */
const getProjectFolder = async ({githubUser, projectName}) => {
  const ownProjectsFolders = ensureArray(config.ownProjectsFolder)
  for (const projectsFolder of ownProjectsFolders) {
    const folder = path.resolve(projectsFolder, projectName)
    const folderExists = await fsp.pathExists(folder)
    if (folderExists) {
      logger.info("Found own project %s in %s", projectName, folder)
      return {
        folder,
        name: projectName,
        shouldPull: true,
        shouldNpmInstall: true,
        shouldUpgrade: true,
        shouldPush: true,
      }
    }
  }
  const foreignProjectsFolders = ensureArray(config.foreignProjectsFolder)
  for (const projectsFolder of foreignProjectsFolders) {
    const folder = path.join(projectsFolder, projectName)
    const folderExists = await fsp.pathExists(folder)
    if (folderExists) {
      logger.info("Found foreign project %s in %s", projectName, folder)
      return {
        folder,
        name: projectName,
        shouldPull: true,
        shouldNpmInstall: true,
        shouldUpgrade: false,
        shouldPush: false,
      }
    }
  }
  const response = await github.repos.listForUser({
    username: githubUser,
    per_page: 100,
    sort: "updated",
    direction: "desc",
    type: "all",
  })
  const matchedRepository = response.data.find(repository => repository.name.toLowerCase() === projectName.toLowerCase())
  if (!matchedRepository) {
    logger.info("No repository named %s found. Searched in %s", projectName, [...ownProjectsFolders, ...foreignProjectsFolders, `${response.data.length} repos`].join(", "))
    return
  }
  if (!isString(ownProjectsFolders[0])) {
    logger.error("config.ownProjectsFolder must contain at least one directory")
    process.exit(1)
  }
  const targetFolder = path.join(ownProjectsFolders[0], matchedRepository.name)
  await simpleGit().clone(matchedRepository.ssh_url, targetFolder)
  return {
    name: matchedRepository.name,
    folder: targetFolder,
    shouldPull: false,
    shouldNpmInstall: true,
    shouldUpgrade: true,
    shouldPush: true,
  }
}

/**
 * @typedef Argv
 * @prop {string} githubUser
 */

/**
 * @param {Argv} argv
 */
const job = async ({npmPath, codePath, githubUser, projectName}) => {
  const project = await getProjectFolder({
    githubUser,
    projectName,
  })
  if (!project) {
    return
  }
  const isGitRepository = await fsp.pathExists(path.join(project.folder, ".git"))
  const packageFile = path.join(project.folder, "package.json")
  const isNodePackage = await fsp.pathExists(packageFile)
  let repository
  let status
  let isDirty
  if (isGitRepository) {
    repository = simpleGit(project.folder)
    status = await repository.status()
    isDirty = status.files?.length > 0
  } else {
    project.shouldPull = false
    project.shouldPush = false
  }
  if (isDirty) {
    logger.info("Repository is dirty, skipping pull")
    project.shouldPull = false
    project.shouldPush = false
    project.shouldUpgrade = false
  }
  if (!isNodePackage) {
    logger.info("No package.json found, skipping install")
    project.shouldNpmInstall = false
    project.shouldUpgrade = false
  }
  if (project.shouldPull) {
    logger.info("Pulling")
    await repository.pull()
  }
  if (project.shouldNpmInstall) {
    logger.info("Installing dependencies")
    await execa(npmPath, ["install"], {
      cwd: project.folder,
      env: {
        NODE_ENV: "development",
      },
    })
    if (isGitRepository && !isDirty) {
      const newStatus = await repository.status()
      const isDirtyNow = newStatus.files?.length > 0
      if (isDirtyNow) {
        await repository.add(project.folder)
        const commitMessage = "Automatically run `npm install`"
        await repository.commit(commitMessage)
        await repository.push()
      }
    }
  }
  if (project.shouldUpgrade) {
    logger.info("Upgrading dependencies")
    await npmCheckUpdates.run({
      jsonUpgraded: true,
      packageManager: "npm",
      upgrade: true,
      timeout: ms`5 minutes`,
      silent: true,
      packageFile,
      packageFileDir: project.folder,
    })
    logger.info("Installing dependencies again")
    await execa(npmPath, ["install"], {
      cwd: project.folder,
      env: {
        NODE_ENV: "development",
      },
    })
    if (isGitRepository && !isDirty) {
      const newStatus = await repository.status()
      const isDirtyNow = newStatus.files?.length > 0
      if (isDirtyNow) {
        await repository.add(project.folder)
        const commitMessage = "Automatically upgraded dependencies"
        logger.info(`Commit: ${commitMessage}`)
        await repository.commit(commitMessage)
        await repository.push()
      }
    }
  }
  logger.info(`Opening ${project.folder} with ${codePath}`)
  await execa(codePath, ["--new-window", project.folder], {
    cwd: project.folder,
    env: {
      NODE_ENV: "development",
    },
  })
}

const main = async () => {
  const [codePath, npmPath] = await Promise.all([
    whichPromise("code"),
    whichPromise("npm"),
  ])
  const builder = {
    "code-path": {
      type: "string",
      default: codePath,
    },
    "npm-path": {
      type: "string",
      default: npmPath,
    },
    "github-user": {
      type: "string",
      default: config.githubUser,
    },
  }
  yargs
    .scriptName("open-project")
    .version(_PKG_VERSION)
    .command("$0 <projectName>", "Opens a project folder in VSCode", builder, job).argv
}

main()