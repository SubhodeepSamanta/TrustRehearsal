import { connectDb } from '../backend/src/db/connection.js';
import { EnvironmentModel, LeaseModel, RunModel } from '../backend/src/db/models.js';
import { LabController } from '../backend/src/lab/controller.js';

async function main() {
  console.log('[ResetLab] Connecting to database...');
  await connectDb();

  const now = new Date();
  const activeLease = await LeaseModel.findOne({
    environmentId: 'sample-lab',
    ownerId: { $ne: 'unclaimed' },
    expiresAt: { $gt: now }
  });

  if (activeLease) {
    console.error(`[ResetLab] Active unexpired lease held by ${activeLease.ownerId} until ${activeLease.expiresAt.toISOString()}. Aborting reset.`);
    process.exit(1);
  }

  // Clear expired or abandoned leases
  await LeaseModel.updateMany(
    { environmentId: 'sample-lab', $or: [{ expiresAt: { $lte: now } }, { ownerId: 'unclaimed' }] },
    { $set: { ownerId: 'unclaimed', expiresAt: new Date(0) } }
  );

  // Clear abandoned runs
  await RunModel.updateMany(
    { environmentId: 'sample-lab', active: true },
    { $set: { active: false, lifecycle: 'interrupted', finishedAt: now.toISOString() } }
  );

  console.log('[ResetLab] Initializing controller and restoring baseline A0 profiles...');
  const controller = new LabController();
  await controller.initialize();

  try {
    await controller.resetToBaseline();

    console.log('[ResetLab] Verifying baseline application path...');
    const verifyRes = await controller.executeApplicationRequest();

    if (!verifyRes.success) {
      console.error(`[ResetLab] Baseline verification failed: ${verifyRes.error || verifyRes.statusCode}`);
      await EnvironmentModel.updateOne(
        { id: 'sample-lab' },
        { $set: { state: 'needs_reset', activeRunId: null } }
      );
      process.exit(1);
    }

    await EnvironmentModel.updateOne(
      { id: 'sample-lab' },
      { $set: { state: 'ready', activeRunId: null, lastVerifiedAt: new Date().toISOString() } }
    );

    console.log('[ResetLab] Environment sample-lab successfully verified and marked ready (200 OK gateway -> orders -> ledger).');
  } finally {
    await controller.stop();
  }

  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[ResetLab] Error resetting lab:', err);
  process.exit(1);
});
