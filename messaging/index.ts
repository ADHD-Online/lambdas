export default () => {
  throw new Error(
    'You forgot to set which handler to use! ' +
    'See ADHD-Online/iac/aws/README.md for more info'
  );
}

export { default as scheduleInitialAppointmentReminder }
  from './flows/scheduleInitialAppointmentReminder';

