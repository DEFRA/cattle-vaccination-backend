import { health } from '../routes/health.js'
import { holdings } from '../routes/holdings.js'
import { workorders } from '../routes/workorders.js'
import { cattleOnHolding } from '../routes/cattle-on-holding.js'
import { cases } from '../routes/cases.js'

export const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([health, holdings, workorders, cattleOnHolding, cases])
    }
  }
}
