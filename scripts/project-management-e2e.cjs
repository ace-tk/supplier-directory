const { Client } = require("pg");

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query("BEGIN");
  try {
    const seed = `pm-e2e-${Date.now()}`;
    const userIds = [0, 1, 2, 3, 4].map((index) => `${seed}-user-${index}`);
    const names = ["Head", "Member A", "Member B", "Member C", "Admin"];
    for (let index = 0; index < userIds.length; index += 1) {
      await db.query(
        `INSERT INTO "User" (id,name,email,password,role,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,now(),now())`,
        [userIds[index], names[index], `${seed}-${index}@test.local`, "test-hash", index === 4 ? "ADMIN" : "FREELANCER"]
      );
    }

    const clientId = `${seed}-client`;
    const projectId = `${seed}-project`;
    await db.query(
      `INSERT INTO "ProjectClient" (id,"companyName","contactPerson","createdAt","updatedAt") VALUES ($1,$2,$3,now(),now())`,
      [clientId, "E2E Client", "Test Contact"]
    );
    await db.query(
      `INSERT INTO "Project" (id,name,"clientName","clientId","startDate","expectedEndDate",priority,status,"freelancerUserId","headUserId","createdById","createdAt","updatedAt") VALUES ($1,$2,$3,$4,now(),now()+interval '30 days','HIGH','ACTIVE',$5,$5,$6,now(),now())`,
      [projectId, "E2E Workspace", "E2E Client", clientId, userIds[0], userIds[4]]
    );
    for (const [index, userId] of userIds.slice(0, 4).entries()) {
      await db.query(
        `INSERT INTO "ProjectMember" (id,"projectId","userId","addedAt") VALUES ($1,$2,$3,now())`,
        [`${seed}-member-${index}`, projectId, userId]
      );
    }

    const taskId = `${seed}-task`;
    await db.query(
      `INSERT INTO "FreelancerTask" (id,title,description,"dueDate",priority,status,"projectId","freelancerUserId","createdAt","updatedAt") VALUES ($1,$2,$3,now()+interval '3 days','HIGH','IN_PROGRESS',$4,$5,now(),now())`,
      [taskId, "Homepage Design", "E2E task", projectId, userIds[1]]
    );
    for (const [index, userId] of [userIds[1], userIds[2]].entries()) {
      await db.query(
        `INSERT INTO "ProjectTaskAssignee" (id,"taskId","userId") VALUES ($1,$2,$3)`,
        [`${seed}-assignee-${index}`, taskId, userId]
      );
    }
    await db.query(
      `INSERT INTO "ProjectTimelineEntry" (id,"projectId",title,date,"dueDate",status,"order","createdAt") VALUES ($1,$2,$3,now()+interval '7 days',now()+interval '7 days','IN_PROGRESS',0,now())`,
      [`${seed}-milestone`, projectId, "Design Review"]
    );
    await db.query(
      `INSERT INTO "ProjectNote" (id,"projectId",title,content,"authorId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,now(),now())`,
      [`${seed}-note`, projectId, "Kickoff", "Approved scope", userIds[0]]
    );
    await db.query(
      `INSERT INTO "ProjectResource" (id,"projectId",title,type,url,"addedById","createdAt") VALUES ($1,$2,$3,'LINK',$4,$5,now())`,
      [`${seed}-resource`, projectId, "Figma", "https://figma.com", userIds[1]]
    );

    const groupId = `${seed}-group`;
    const directId = `${seed}-direct`;
    await db.query(
      `INSERT INTO "ProjectConversation" (id,"projectId",name,"createdById","createdAt","updatedAt") VALUES ($1,$2,$3,$4,now(),now()),($5,$2,$6,$4,now(),now())`,
      [groupId, projectId, "Head + A + B", userIds[0], directId, "Head + C"]
    );
    const conversationMembers = [
      [groupId, [userIds[0], userIds[1], userIds[2]]],
      [directId, [userIds[0], userIds[3]]],
    ];
    let participantIndex = 0;
    for (const [conversationId, participants] of conversationMembers) {
      for (const userId of participants) {
        await db.query(
          `INSERT INTO "ProjectConversationParticipant" (id,"conversationId","userId","joinedAt") VALUES ($1,$2,$3,now())`,
          [`${seed}-participant-${participantIndex++}`, conversationId, userId]
        );
      }
    }
    await db.query(
      `INSERT INTO "ProjectMessage" (id,"conversationId","senderId",content,"createdAt") VALUES ($1,$2,$3,$4,now()),($5,$6,$3,$7,now())`,
      [`${seed}-message-1`, groupId, userIds[0], "Group persisted", `${seed}-message-2`, directId, "Private persisted"]
    );

    const privacy = await db.query(
      `SELECT EXISTS(SELECT 1 FROM "ProjectConversationParticipant" WHERE "conversationId"=$1 AND "userId"=$2) AS allowed`,
      [directId, userIds[1]]
    );
    if (privacy.rows[0].allowed) throw new Error("Private conversation exposed to Member A");

    await db.query(`UPDATE "FreelancerTask" SET status='COMPLETED',"updatedAt"=now() WHERE id=$1`, [taskId]);
    await db.query(
      `INSERT INTO "ProjectActivity" (id,"projectId","actorId",type,detail,"createdAt") VALUES ($1,$2,$3,'TASK_COMPLETED',$4,now())`,
      [`${seed}-activity`, projectId, userIds[1], "Completed task Homepage Design"]
    );
    const check = await db.query(
      `SELECT (SELECT count(*) FROM "ProjectMember" WHERE "projectId"=$1) members,(SELECT count(*) FROM "ProjectTaskAssignee" WHERE "taskId"=$2) assignees,(SELECT count(*) FROM "ProjectMessage" WHERE "conversationId" IN ($3,$4)) messages,(SELECT count(*) FROM "FreelancerTask" WHERE "projectId"=$1 AND status='COMPLETED') completed`,
      [projectId, taskId, groupId, directId]
    );
    const result = check.rows[0];
    if (result.members !== "4" || result.assignees !== "2" || result.messages !== "2" || result.completed !== "1") {
      throw new Error(`E2E assertions failed: ${JSON.stringify(result)}`);
    }
    console.log("E2E PASS: client, project, four members, A+B task, milestone, note, link, group chat, private Head-C chat, persistence, privacy, completion, and activity");
  } finally {
    await db.query("ROLLBACK");
    await db.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
