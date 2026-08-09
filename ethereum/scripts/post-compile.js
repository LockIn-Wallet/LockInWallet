const { syncAbis } = require("./sync-abis");

/**
 * Post-compile hook that refreshes the frontend's ABIs.
 *
 * It syncs everything on the shared list, not a hand-picked few: a compile that
 * changed a module and left the frontend's copy behind is the exact setup for a
 * runtime decode error that looks like a network problem.
 */
async function updateABIs() {
  console.log("🔄 Auto-updating frontend ABIs after compilation...");
  try {
    const updated = syncAbis({ quiet: true });
    console.log(`✅ Auto-updated ${updated} ABI files`);
  } catch (error) {
    console.log("❌ Error during automatic ABI update:", error.message);
  }
}

if (require.main === module) {
  updateABIs();
}

module.exports = { updateABIs };
