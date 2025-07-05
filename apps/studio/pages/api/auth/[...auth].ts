import { auth } from "../../../lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export default toNextJsHandler(auth)

// Disable body parsing for the auth handler
export const config = {
  api: {
    bodyParser: false,
  },
}