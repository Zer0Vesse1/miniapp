import { handleDataRequest } from '../../../server/sync-data.js';

export function onRequest(context) {
  return handleDataRequest(context, context.params.scope);
}
