// Runs once before the workers start, so date and time assertions don't depend on the machine's timezone
export default function setup() {
  process.env.TZ = 'UTC'
}
