import whichPromise from "which-promise"
import yargs from "yargs"

import config from "lib/config"

import handleCommand from "src/main"

const main = async () => {
  const [codePath, npmPath] = await Promise.all([
    whichPromise("code"),
    whichPromise("npm"),
  ])
  /**
   * @type {import("yargs").CommandBuilder}
   */
  const commandBuilder = {
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
    .scriptName(process.env.REPLACE_PKG_NAME)
    .version(process.env.REPLACE_PKG_VERSION)
    .command("* <projectName>", process.env.REPLACE_PKG_DESCRIPTION, commandBuilder, handleCommand)
    .parse()
}

main()