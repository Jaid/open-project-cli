import essentialConfig from "essential-config"

import logger from "lib/logger"

import defaults from "./defaults.yml"

const config = essentialConfig(process.env.REPLACE_PKG_TITLE, {
  defaults,
  secretKeys: [
    "githubClientId",
    "githubClientSecret",
  ],
})

if (!config) {
  logger.warn("Set up default config, please review and edit this file")
}

export const appFolder = config.appFolder
export default config.config || defaults