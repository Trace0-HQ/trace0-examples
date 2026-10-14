import pino from 'pino';

const logger = pino({
  mixin() {
    return {
      'service.name': process.env['OTEL_SERVICE_NAME'],
    };
  },

  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
});

export default logger;
