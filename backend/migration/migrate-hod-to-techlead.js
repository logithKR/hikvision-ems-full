const admin = require('../firebase-admin')();
const db = admin.firestore();

async function migrateHODToTechLead() {
  console.log('🚀 Starting migration: HOD to Tech Lead...');
  let migratedUsersCount = 0;
  let migratedDeptsCount = 0;

  try {
    const orgsSnapshot = await db.collection('organizations').get();
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      console.log(`\n🏢 Processing organization: ${orgId}`);

      // Migrate Users
      const usersRef = db.collection('organizations').doc(orgId).collection('users');
      const usersSnapshot = await usersRef.get();
      
      const batch = db.batch();
      let hasUserUpdates = false;

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        let needsUpdate = false;
        const updates = {};

        if (userData.role === 'hod') {
          updates.role = 'tech_lead';
          needsUpdate = true;
        }

        if (userData.position && (userData.position.toLowerCase().includes('hod') || userData.position.toLowerCase().includes('department head'))) {
          updates.position = 'Tech Lead';
          needsUpdate = true;
        }
        
        if (userData.isDeptHead === true) {
          // We keep isDeptHead for backward compatibility in backend logic, but update string references
          // if there are any other string references like 'HOD' in managerName etc., we update them.
          if (userData.name && userData.name.includes('(HOD)')) {
            updates.name = userData.name.replace('(HOD)', '(Tech Lead)');
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          batch.update(userDoc.ref, updates);
          hasUserUpdates = true;
          migratedUsersCount++;
          console.log(`   - Updating user: ${userData.email} (${userDoc.id})`);
        }
      }

      // Migrate Departments
      const deptsRef = db.collection('organizations').doc(orgId).collection('departments');
      const deptsSnapshot = await deptsRef.get();
      let hasDeptUpdates = false;

      for (const deptDoc of deptsSnapshot.docs) {
        const deptData = deptDoc.data();
        let needsUpdate = false;
        const updates = {};

        // If department head role strings exist in dept documents
        // e.g. some systems store { headRole: 'hod' }
        if (deptData.headTitle === 'HOD' || deptData.headTitle === 'Department Head') {
          updates.headTitle = 'Tech Lead';
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          batch.update(deptDoc.ref, updates);
          hasDeptUpdates = true;
          migratedDeptsCount++;
          console.log(`   - Updating dept: ${deptData.name || deptDoc.id}`);
        }
      }

      if (hasUserUpdates || hasDeptUpdates) {
        await batch.commit();
        console.log(`   ✅ Committed updates for org ${orgId}`);
      } else {
        console.log(`   - No updates needed for org ${orgId}`);
      }
    }

    console.log(`\n🎉 Migration completed successfully!`);
    console.log(`📊 Migrated ${migratedUsersCount} users.`);
    console.log(`📊 Migrated ${migratedDeptsCount} departments.`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrateHODToTechLead();
