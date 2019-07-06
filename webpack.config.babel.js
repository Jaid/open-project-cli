import configure from "webpack-config-jaid"

export default configure({
  publishimo: {
    fetchGithub: true,
    binName: "open-project",
  },
})