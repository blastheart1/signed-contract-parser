/**
 * Reference Number Generator Service
 * 
 * Generates unique reference numbers in the format YYYY-XXXXX
 * where YYYY is the year and XXXXX is a 5-digit sequence number.
 * 
 * Reference numbers are per-year continuous and never reuse deleted numbers.
 */

import { db } from '@/lib/db';
import { referenceNumberSequence } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Generates the next reference number for a given year
 * Format: YYYY-XXXXX (e.g., 2024-00001)
 * 
 * @param year - The year for which to generate the reference number (defaults to current year)
 * @returns Promise<string> - The generated reference number
 * @throws Error if sequence generation fails
 */
export async function generateReferenceNumber(year?: number): Promise<string> {
  const currentYear = year || new Date().getFullYear();
  
  try {
    // Use a transaction to ensure atomicity and prevent race conditions
    const result = await db.transaction(async (tx) => {
      // Try to get existing sequence for the year
      const existing = await tx
        .select()
        .from(referenceNumberSequence)
        .where(eq(referenceNumberSequence.year, currentYear))
        .limit(1);

      let nextSequence: number;

      if (existing.length === 0) {
        // First reference number for this year - start at 1
        nextSequence = 1;
        
        // Insert new sequence record
        await tx.insert(referenceNumberSequence).values({
          year: currentYear,
          lastSequence: nextSequence,
          updatedAt: new Date(),
        });
      } else {
        // Increment existing sequence
        nextSequence = (existing[0].lastSequence || 0) + 1;
        
        // Update sequence atomically
        await tx
          .update(referenceNumberSequence)
          .set({
            lastSequence: nextSequence,
            updatedAt: new Date(),
          })
          .where(eq(referenceNumberSequence.year, currentYear));
      }

      // Format: YYYY-XXXXX (5 digits, zero-padded)
      const sequenceStr = nextSequence.toString().padStart(5, '0');
      return `${currentYear}-${sequenceStr}`;
    });

    return result;
  } catch (error) {
    console.error('Error generating reference number:', error);
    throw new Error(
      `Failed to generate reference number for year ${currentYear}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Gets the current sequence number for a given year (without incrementing)
 * Useful for checking the last used number
 * 
 * @param year - The year to check (defaults to current year)
 * @returns Promise<number> - The current sequence number (0 if none exists)
 */
export async function getCurrentSequence(year?: number): Promise<number> {
  const currentYear = year || new Date().getFullYear();
  
  try {
    const result = await db
      .select()
      .from(referenceNumberSequence)
      .where(eq(referenceNumberSequence.year, currentYear))
      .limit(1);

    return result.length > 0 ? (result[0].lastSequence || 0) : 0;
  } catch (error) {
    console.error('Error getting current sequence:', error);
    return 0;
  }
}

