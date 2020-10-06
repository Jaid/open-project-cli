import jaidLogger from "jaid-logger"

const logger = jaidLogger(process.env.REPLACE_PKG_TITLE)

logger.info(`${process.env.REPLACE_PKG_TITLE} v${process.env.REPLACE_PKG_VERSION}`)

export const log = logger.info
export default logger