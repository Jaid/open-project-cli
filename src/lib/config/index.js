import essentialConfig from "essential-config"

import logger from "lib/logger"

import defaults from "./defaults.yml"

const config = essentialConfig(_PKG_TITLE, {
  defaults,
  sensitiveKeys: [
    "githubClientId",
    "githubClientSecret",
  ],
})

if (!config) {
  logger.warn("Set up default config, please review and edit this file")
}

export const appFolder = config.appFolder
export default config.config || defaults