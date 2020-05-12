/// <reference path='../node_modules/mocha-typescript/globals.d.ts' />
import * as firebase from "@firebase/testing";
import * as fs from "fs";

/*
 * ============
 *    Setup
 * ============
 */
const projectId = "firestore-emulator-example";
const coverageUrl = `http://localhost:8080/emulator/v1/projects/${projectId}:ruleCoverage.html`;

const rules = fs.readFileSync("firestore.rules", "utf8");

/**
 * Creates a new app with authentication data matching the input.
 *
 * @param {object} auth the object to use for authentication (typically {uid: some-uid})
 * @return {object} the app.
 */
function authedApp(auth) {
  return firebase.initializeTestApp({ projectId, auth }).firestore();
}

/*
 * ============
 *  Test Cases
 * ============
 */
before(async () => {
  await firebase.loadFirestoreRules({ projectId, rules });
});

beforeEach(async () => {
  // Clear the database between tests
  await firebase.clearFirestoreData({ projectId });
});

after(async () => {
  await Promise.all(firebase.apps().map((app) => app.delete()));
  console.log(`View rule coverage information at ${coverageUrl}\n`);
});

@suite
class UserProfiles {
  @test
  async "require users to log in before creating a profile"() {
    const db = authedApp(null);
    const profile = db.collection("users").doc("alice");
    await firebase.assertFails(profile.set({ fullName: "Alice Aliceton" }));
  }

  @test
  async "should enforce the createdAt date in user profiles"() {
    const db = authedApp({ uid: "alice" });
    const profile = db.collection("users").doc("alice");
    await firebase.assertFails(profile.set({ fullName: "Alice Aliceton" }));
    await firebase.assertSucceeds(
      profile.set({
        fullName: "Alice Aliceton",
        email: "alice@example.com",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  }

  @test
  async "should only let users create their own profile"() {
    const db = authedApp({ uid: "alice" });
    await firebase.assertSucceeds(
      db
        .collection("users")
        .doc("alice")
        .set({
          fullName: "Alice Aliceton",
          email: "alice@example.com",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
    );
    await firebase.assertFails(
      db
        .collection("users")
        .doc("bob")
        .set({
          fullName: "Bob Bobbins",
          email: "bob@example.com",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
    );
  }

  /*@test
  async "should let anyone read any profile"() {
    const db = authedApp(null);
    const profile = db.collection("users").doc("alice");
    await firebase.assertSucceeds(profile.get());
  }*/

  @test
  async "should only let the owner read their own profile"() {
    const db = authedApp(null);
    const alice = authedApp({ uid: "alice" });

    await firebase.assertFails(
      db
        .collection("users")
        .doc("alice")
        .get()
    );
    await firebase.assertFails(
      alice
        .collection("users")
        .doc("alice")
        .get()
    );
  }
}

@suite
class Items {
  @test
  async "should let anyone create a item"() {
    const db = authedApp({ uid: "alice" });
    const item = db.collection("items").doc("firebase");
    await firebase.assertSucceeds(
      item.set({
        owner: "alice",
        topic: "All Things Firebase",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  }

  @test
  async "should force people to name themselves as item owner when creating a item"() {
    const db = authedApp({ uid: "alice" });
    const item = db.collection("items").doc("firebase");
    await firebase.assertFails(
      item.set({
        owner: "scott",
        topic: "Firebase Rocks!",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  }

  @test
  async "should only let owners see their items"() {
    const alice = authedApp({ uid: "alice" });
    const bob = authedApp({ uid: "bob" });

    await bob
      .collection("items")
      .doc("snowBob")
      .set({
        owner: "bob",
        topic: "All Things Snowboarding",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

    await alice
      .collection("items")
      .doc("snowAlice")
      .set({
        owner: "alice",
        topic: "skiing > snowboarding",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

    await firebase.assertFails(alice.collection("items").get());

    await firebase.assertSucceeds(
      alice
        .collection("items")
        .where("owner", "==", "alice")
        .get()
    );

    await firebase.assertFails(
      bob
        .collection("items")
        .doc("snowAlice")
        .get()
    );

    await firebase.assertSucceeds(
      alice
        .collection("items")
        .doc("snowAlice")
        .get()
    );
  }

  @test
  async "should let one user update their own item"() {
    const alice = authedApp({ uid: "alice" });

    await firebase.assertSucceeds(
      alice
        .collection("items")
        .doc("snowAliceToUpdate")
        .set({
          owner: "alice",
          topic: "All Things Snowboarding",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
    );

    await firebase.assertFails(
      alice
        .collection("items")
        .doc("snowAliceToUpdate")
        .set({
          owner: "bob",
          topic: "All Things Snowboarding",
          modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
    );

    await firebase.assertFails(
      alice
        .collection("items")
        .doc("snowAliceToUpdate")
        .set({
          owner: "alice",
          topic: "All Things Snowboarding",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
    );

    await firebase.assertFails(
      alice
        .collection("items")
        .doc("snowAliceToUpdate")
        .set({
          owner: "alice",
          topic: "All Things Snowboarding",
          modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
          invalidField: 'hello',
        })
    );

    await firebase.assertSucceeds(
      alice
        .collection("items")
        .doc("snowAliceToUpdate")
        .set({
          owner: "alice",
          topic: "skiing > snowboarding",
          modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
    );
  }

  @test
  async "should not let one user steal a item from another user"() {
    const alice = authedApp({ uid: "alice" });
    const bob = authedApp({ uid: "bob" });

    await firebase.assertSucceeds(
      bob
        .collection("items")
        .doc("snow")
        .set({
          owner: "bob",
          topic: "All Things Snowboarding",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
    );

    await firebase.assertFails(
      alice
        .collection("items")
        .doc("snow")
        .set({
          owner: "alice",
          topic: "skiing > snowboarding",
          modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
    );
  }

  @test
  async "should not let one user delete a item of another user"() {
    const alice = authedApp({ uid: "alice" });
    const bob = authedApp({ uid: "bob" });

    await bob
      .collection("items")
      .doc("snowBobToDelete")
      .set({
        owner: "bob",
        topic: "All Things Snowboarding",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

    await alice
      .collection("items")
      .doc("snowAliceToDelete")
      .set({
        owner: "alice",
        topic: "skiing > snowboarding",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

    await firebase.assertSucceeds(
      alice
        .collection("items")
        .doc("snowAliceToDelete")
        .delete()
    );

    await firebase.assertFails(
      bob
        .collection("items")
        .doc("snowAliceToDelete")
        .delete()
    );
  }
}

/*
 * ==================
 *  Example Requests
 * ==================
 */

async function getYourItems() {
  const alice = authedApp({ uid: "alice" });
  const itemsRef = alice.collection("items");

  try {
    const snapshot = await itemsRef.where("owner", "==", "alice").get();

    if (snapshot.empty) {
      console.log("No matching documents.");
      return;
    }

    snapshot.forEach((doc) => {
      console.log(doc.id, "=>", doc.data());
    });
  } catch (err) {
    console.log("Error getting documents", err);
  }
}

async function getAllItems() {
  // Won't work for logged in and anon users
  const alice = authedApp({ uid: "alice" });
  const itemsRef = alice.collection("items");

  try {
    const snapshot = await itemsRef.get();

    snapshot.forEach((doc) => {
      console.log(doc.id, "=>", doc.data());
    });
  } catch (err) {
    console.log("Error getting documents", err);
  }
}

async function getOneItem() {
  const alice = authedApp({ uid: "alice" });
  const itemsRef = alice.collection("items");

  try {
    const doc = await itemsRef.doc("snowAlice").get();

    if (!doc.exists) {
      console.log("No such document!");
    } else {
      console.log("Document data:", doc.data());
    }
  } catch (err) {
    console.log("Error getting documents", err);
  }
}
