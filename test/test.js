import coffee from "coffee"
import ms from "ms.macro"
import path from "path"

const main = path.resolve(process.env.MAIN)

it("should run", () => coffee.fork(main, ["_something-that-does-not-exist_"])
  .expect("code", 0)
  .expect("stdout", /No repository named _something-that-does-not-exist_ found\./)
  .debug(true)
  .end(), ms`1 minute`)