<?php

namespace App\Console\Commands;

use App\Models\Farmer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Move farmer ID proofs off the public disk.
 *
 * Uploads now go to the private disk, but the files uploaded before that change
 * are still sitting under storage/app/public, where the storage:link symlink
 * makes them readable by anyone holding the URL. This walks the ones the
 * database knows about and moves them across.
 *
 * Copy, verify, then delete — never rename() and never a bare move. The
 * original is removed only after the private copy has been confirmed present
 * and byte-for-byte the same size. Anything that does not verify is left on
 * both disks and reported; a document that survives twice is recoverable, one
 * deleted against a failed copy is not.
 *
 * Nothing is written to the database. id_proof_path holds a relative path that
 * is identical on either disk, so the column is already correct for both the
 * old location and the new one.
 *
 * Idempotent. A file already private is skipped, so this can be run after every
 * deployment without thinking about whether it ran last time.
 */
class MoveIdProofsToPrivate extends Command
{
    protected $signature = 'farmers:move-id-proofs
                            {--dry-run : Report what would move without touching anything}';

    protected $description = 'Move farmer ID proofs from the public disk to private storage';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $public  = Storage::disk('public');
        $private = Storage::disk('local');

        $farmers = Farmer::query()
            ->whereNotNull('id_proof_path')
            ->where('id_proof_path', '!=', '')
            ->orderBy('id')
            ->get(['id', 'first_name', 'last_name', 'id_proof_path']);

        if ($farmers->isEmpty()) {
            $this->info('No farmer has an ID proof recorded. Nothing to do.');

            return self::SUCCESS;
        }

        $this->info(($dryRun ? 'DRY RUN — ' : '') . "Checking {$farmers->count()} ID proof(s).");
        $this->newLine();

        $moved = $skipped = $missing = $failed = 0;

        foreach ($farmers as $farmer) {
            $path  = $farmer->id_proof_path;
            $who   = "#{$farmer->id} {$farmer->first_name} {$farmer->last_name}";

            // Already private, from an earlier run or a post-change upload.
            if ($private->exists($path)) {
                if ($public->exists($path)) {
                    /*
                     * Both copies exist — an earlier run got as far as copying
                     * and stopped before the delete. Finish the job, but only
                     * after re-checking the sizes agree.
                     */
                    if ($private->size($path) === $public->size($path)) {
                        if (! $dryRun) {
                            $public->delete($path);
                        }
                        $this->line("  <fg=yellow>tidied</> {$who} — removed leftover public copy");
                        $moved++;
                        continue;
                    }

                    $this->line("  <fg=red>differs</> {$who} — private and public copies differ in size, left alone");
                    $failed++;
                    continue;
                }

                $this->line("  <fg=gray>already private</> {$who}");
                $skipped++;
                continue;
            }

            if (! $public->exists($path)) {
                // Recorded in the database but absent from both disks. Reported
                // rather than cleared: the column is evidence that a document
                // was once uploaded, and deciding it is gone is not this
                // command's call to make.
                $this->line("  <fg=red>missing</> {$who} — {$path} is on neither disk");
                $missing++;
                continue;
            }

            if ($dryRun) {
                $this->line("  <fg=green>would move</> {$who} — {$path} (" . $public->size($path) . ' bytes)');
                $moved++;
                continue;
            }

            $expected = $public->size($path);

            // Streamed rather than read into memory, so a large scan does not
            // have to fit in the PHP memory limit.
            $stream = $public->readStream($path);

            if ($stream === null) {
                $this->line("  <fg=red>unreadable</> {$who} — {$path}");
                $failed++;
                continue;
            }

            $private->writeStream($path, $stream);

            if (is_resource($stream)) {
                fclose($stream);
            }

            // The verification the whole command exists for.
            if (! $private->exists($path) || $private->size($path) !== $expected) {
                $this->line("  <fg=red>FAILED</> {$who} — copy did not verify, public original kept");
                $failed++;
                continue;
            }

            $public->delete($path);

            $this->line("  <fg=green>moved</> {$who} — {$path} ({$expected} bytes)");
            $moved++;
        }

        $this->newLine();
        $this->table(
            ['Moved', 'Already private', 'Missing file', 'Failed'],
            [[$moved, $skipped, $missing, $failed]],
        );

        if ($dryRun) {
            $this->comment('Dry run — nothing was copied or deleted. Re-run without --dry-run to apply.');

            return self::SUCCESS;
        }

        if ($failed > 0) {
            $this->error("{$failed} file(s) did not verify. Their public originals were NOT deleted.");

            return self::FAILURE;
        }

        $this->info('Done. ID proofs are no longer reachable through /storage.');

        return self::SUCCESS;
    }
}
