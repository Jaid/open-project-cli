import path from "path"

import coffee from "coffee"

const main = path.resolve(process.env.MAIN)

it("should run", () => coffee.fork(main, ["_something-that-does-not-exist_"])
  .expect("code", 0)
  .expect("stdout", /No repository named _something-that-does-not-exist_ found\./)
  .debug(true)
  .end())