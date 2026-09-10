<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What the office has written to farmers.
 *
 * Until now a manual email left only an audit entry — who wrote to whom, when,
 * and the subject — and the text itself was deliberately not kept. That was
 * the right call for an audit trail, and the wrong one for the office, which
 * needs to read back what it actually told somebody: what a farmer was
 * promised, and in whose words.
 *
 * So the message is a record now rather than a log line. The audit entry stays
 * as it is: the two answer different questions, and the audit log must remain
 * the tamper-evident one.
 *
 * Sends made before this table existed have no text and never can — the body
 * was never written down. The history shows them from the audit log, marked.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farmer_messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();

            // Who sent it. Nulled rather than cascaded if the account is later
            // removed: the message was still sent, and deleting a staff record
            // must not quietly erase the correspondence.
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();

            // The address it actually went to, as resolved at the time. The
            // farmer's email may change afterwards, and the history should say
            // where the message went, not where it would go today.
            $table->string('sent_to', 100);

            $table->string('subject', 200);
            $table->text('body');

            $table->timestamps();

            // The two ways this is read: one farmer's correspondence, and the
            // whole outbox newest first.
            $table->index(['farmer_id', 'created_at'], 'idx_messages_farmer');
            $table->index('created_at', 'idx_messages_sent');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farmer_messages');
    }
};
