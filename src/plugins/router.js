import { health } from '../routes/health.js'
import { holdings } from '../routes/holdings.js'
import { getWorkOrderRoute, workorders } from '../routes/workorders.js'
import { cattleOnHolding } from '../routes/cattle-on-holding.js'
import { getCphRoute } from '../routes/cphs.js'

export const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([health, holdings, workorders, getWorkOrderRoute, cattleOnHolding, getCphRoute])
    },
  },
}
