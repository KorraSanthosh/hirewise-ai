import { prisma } from '../src/lib/prisma';
import { MatchingService } from '../src/services/matching.service';

async function main() {
  console.log('Starting match score recalculation for all jobs...');
  
  // 1. Fetch all jobs
  const jobs = await prisma.job.findMany({
    select: { id: true, title: true }
  });
  
  console.log(`Found ${jobs.length} jobs in the database.`);
  
  // 2. Run matching for each job
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    console.log(`[${i + 1}/${jobs.length}] Recalculating matches for Job: "${job.title}" (ID: ${job.id})...`);
    try {
      const matchCount = await MatchingService.runJobMatching(job.id);
      console.log(`Successfully recalculated ${matchCount} matches for Job: "${job.title}".`);
    } catch (error) {
      console.error(`Failed to recalculate matches for Job: "${job.title}":`, error);
    }
  }
  
  console.log('Recalculation complete.');
}

main()
  .catch((e) => {
    console.error('Error during match recalculation script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
