const fs = require('node:fs');
const path = require('node:path');

const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc } = require('firebase/firestore');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sismoconnect',
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'alice'), { displayName: 'Alice', unlocks: 0 });
    await setDoc(doc(db, 'users', 'bob'), { displayName: 'Bob', unlocks: 0 });
    await setDoc(doc(db, 'publicProfiles', 'alice'), {
      displayName: 'Alice',
      isPublic: true,
    });
    await setDoc(doc(db, 'chats', 'chat1'), { memberIds: ['alice', 'bob'] });
    await setDoc(doc(db, 'chats', 'chat1', 'members', 'alice'), { uid: 'alice' });
    await setDoc(doc(db, 'chats', 'chat1', 'members', 'bob'), { uid: 'bob' });
    await setDoc(doc(db, 'chats', 'chat1', 'messages', 'm1'), { text: 'Hola' });
    await setDoc(doc(db, 'chats', 'global_sala_comunitaria'), {
      type: 'group',
      title: 'Sala Comunitaria',
      memberIds: [],
    });
    await setDoc(doc(db, 'chats', 'global_sala_comunitaria', 'messages', 'gm1'), {
      text: 'Hola global',
    });
    await setDoc(doc(db, 'admobRewards', 'tx1'), { uid: 'alice', unlocks: 1 });
    await setDoc(doc(db, 'notifications', 'n1'), { uid: 'alice', title: 'Aviso' });
    await setDoc(doc(db, 'pushDevices', 'd1'), { uid: 'alice', token: 'secret' });
    await setDoc(doc(db, 'system', 'earthquakePush'), { marker: true });
  });
});

describe('unauthenticated access', () => {
  it('cannot read public profiles', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'publicProfiles', 'alice')));
  });

  it('cannot read the global room', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'chats', 'global_sala_comunitaria')));
  });
});

describe('profiles and usernames', () => {
  it('lets a signed-in user read public profiles', async () => {
    const db = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(db, 'publicProfiles', 'alice')));
  });

  it('keeps private user documents owner-only', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(aliceDb, 'users', 'alice')));
    await assertFails(getDoc(doc(bobDb, 'users', 'alice')));
  });

  it('blocks client profile writes', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'users', 'alice'), { unlocks: 99 }));
    await assertFails(setDoc(doc(db, 'publicProfiles', 'alice'), { displayName: 'Fake' }));
  });
});

describe('personal alerts', () => {
  it('allows owners to create, read and update their alerts', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'alertas', 'a1'), { userId: 'alice', threshold: 5 })
    );
    await assertSucceeds(getDoc(doc(db, 'alertas', 'a1')));
    await assertSucceeds(
      setDoc(doc(db, 'alertas', 'a1'), { userId: 'alice', threshold: 6 })
    );
  });

  it('rejects alerts for another user', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'alertas', 'a2'), { userId: 'bob', threshold: 5 })
    );
  });
});

describe('friendships, blocks and reports', () => {
  it('only exposes friendships to their members', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'friendships', 'alice_bob'), {
        memberIds: ['alice', 'bob'],
        pairId: 'alice_bob',
      });
    });
    await assertSucceeds(
      getDoc(doc(testEnv.authenticatedContext('alice').firestore(), 'friendships', 'alice_bob'))
    );
    await assertFails(
      getDoc(doc(testEnv.authenticatedContext('eve').firestore(), 'friendships', 'alice_bob'))
    );
  });

  it('keeps reports closed to clients', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'reports', 'r1'), { targetUid: 'bob' }));
  });
});

describe('chats', () => {
  it('lets members read the chat and its messages', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(db, 'chats', 'chat1')));
    await assertSucceeds(getDoc(doc(db, 'chats', 'chat1', 'messages', 'm1')));
    await assertSucceeds(getDoc(doc(db, 'chats', 'chat1', 'members', 'bob')));
  });

  it('rejects non-members and client message writes', async () => {
    const eveDb = testEnv.authenticatedContext('eve').firestore();
    await assertFails(getDoc(doc(eveDb, 'chats', 'chat1')));
    await assertFails(getDoc(doc(eveDb, 'chats', 'chat1', 'messages', 'm1')));

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'chats', 'chat1', 'messages', 'm2'), { text: 'forged' })
    );
  });

  it('lets any signed-in user read the global room without a member document', async () => {
    const eveDb = testEnv.authenticatedContext('eve').firestore();
    await assertSucceeds(getDoc(doc(eveDb, 'chats', 'global_sala_comunitaria')));
    await assertSucceeds(
      getDoc(doc(eveDb, 'chats', 'global_sala_comunitaria', 'messages', 'gm1'))
    );
  });

  it('keeps global room writes closed to clients', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'chats', 'global_sala_comunitaria', 'messages', 'gm2'), {
        text: 'forged',
      })
    );
  });
});

describe('notifications and push', () => {
  it('only lets the owner read their inbox', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(aliceDb, 'notifications', 'n1')));
    await assertFails(getDoc(doc(bobDb, 'notifications', 'n1')));
  });

  it('keeps devices and internal markers server-only', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(db, 'pushDevices', 'd1')));
    await assertFails(getDoc(doc(db, 'system', 'earthquakePush')));
    await assertFails(setDoc(doc(db, 'notifications', 'n2'), { uid: 'alice', title: 'Fake' }));
  });
});

describe('rewards and config', () => {
  it('only exposes an SSV receipt to its owner', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(aliceDb, 'admobRewards', 'tx1')));
    await assertFails(getDoc(doc(bobDb, 'admobRewards', 'tx1')));
  });

  it('allows signed-in users to read chat config', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'config', 'chat'), { cooldownSeconds: 30 });
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(db, 'config', 'chat')));
    await assertFails(setDoc(doc(db, 'config', 'chat'), { cooldownSeconds: 0 }));
  });
});
