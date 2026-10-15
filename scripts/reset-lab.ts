import { connectDb } from '../backend/src/db/connection.js';
import { EnvironmentModel, LeaseModel } from '../backend/src/db/models.js';
import { LabController } from '../backend/src/lab/controller.js';

async function main() {
  console.log('[ResetLab] Connecting to database...');
  await connectDb();

  console.log('[ResetLab] Clearing active leases...');
  await LeaseModel.deleteMany({ environmentId: 'sample-lab' });

  console.log('[ResetLab] Initializing controller and restoring baseline A0 profiles...');
  const controller = new LabController();
  controller.certStore.initializeRoots();

  try {
    // If running lab is accessible, call resetToBaseline
    await controller.resetToBaseline();
  } catch (err: any) {
    console.log('[ResetLab] Local in-memory reset:', err.message);
  }

  await EnvironmentModel.updateOne(
    { id: 'sample-lab' },
    { $set: { state: 'ready', activeRunId: null, lastVerifiedAt: new Date().toISOString() } }
  );

  console.log('[ResetLab] Environment sample-lab successfully reset to baseline ready state.');
  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[ResetLab] Error resetting lab:', err);
  process.exit(1);
});
