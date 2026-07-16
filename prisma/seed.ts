import {
  PrismaClient,
  Role,
  VoteValue,
  NotificationType,
  ReportReason,
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const userSeeds = [
  [
    "Maya Chen",
    "mayachen",
    "maya@queryhub.dev",
    "Product designer making complex systems feel simple",
  ],
  [
    "Admin QueryHub",
    "admin",
    "admin@queryhub.dev",
    "Community operations and platform safety",
  ],
  [
    "Morgan Lee",
    "moderator",
    "moderator@queryhub.dev",
    "Community moderator and digital policy researcher",
  ],
  [
    "Elena Marquez",
    "elenamarquez",
    "elena@example.com",
    "Cognitive scientist studying how people learn",
  ],
  [
    "Sam Okafor",
    "samokafor",
    "sam@example.com",
    "Staff engineer working on distributed systems",
  ],
  [
    "Priya Nair",
    "priyanair",
    "priya@example.com",
    "Climate investor and former materials researcher",
  ],
  [
    "Noah Williams",
    "noahw",
    "noah@example.com",
    "Designing tools for creative teams",
  ],
  [
    "Aarav Mehta",
    "aaravm",
    "aarav@example.com",
    "Product strategist and systems thinker",
  ],
  [
    "Sofia Rossi",
    "sofiar",
    "sofia@example.com",
    "Urban planner focused on resilient cities",
  ],
  [
    "Daniel Kim",
    "danielk",
    "daniel@example.com",
    "Security engineer and open-source maintainer",
  ],
  [
    "Amara Johnson",
    "amaraj",
    "amara@example.com",
    "Teacher, writer, and lifelong learner",
  ],
  [
    "Lucas Martin",
    "lucasm",
    "lucas@example.com",
    "Founder building tools for independent businesses",
  ],
  [
    "Zara Ahmed",
    "zaraahmed",
    "zara@example.com",
    "Physician interested in public health communication",
  ],
  [
    "Theo Brown",
    "theob",
    "theo@example.com",
    "Data journalist working with public-interest datasets",
  ],
  [
    "Mei Tan",
    "meitan",
    "mei@example.com",
    "Organizational psychologist and leadership coach",
  ],
  [
    "Ibrahim Yusuf",
    "ibrahimy",
    "ibrahim@example.com",
    "Robotics researcher and science educator",
  ],
] as const;

const topicSeeds = [
  [
    "Artificial Intelligence",
    "artificial-intelligence",
    "Practical applications, research, policy, and the people shaping intelligent systems.",
    "#4f46e5",
  ],
  [
    "Product Design",
    "product-design",
    "Crafting useful, accessible, and delightful digital products.",
    "#e11d48",
  ],
  [
    "Behavioral Science",
    "behavioral-science",
    "How people think, decide, learn, and change.",
    "#0891b2",
  ],
  [
    "Climate Technology",
    "climate-technology",
    "Engineering and policy for a lower-carbon future.",
    "#059669",
  ],
  [
    "Career Growth",
    "career-growth",
    "Thoughtful advice for building a durable, meaningful career.",
    "#d97706",
  ],
  [
    "Software Engineering",
    "software-engineering",
    "Systems, teams, tools, and practices behind dependable software.",
    "#7c3aed",
  ],
  [
    "Leadership",
    "leadership",
    "Building healthy teams and making responsible decisions.",
    "#2563eb",
  ],
  [
    "Health Communication",
    "health-communication",
    "Clear, evidence-based conversations about health.",
    "#db2777",
  ],
  [
    "Economics",
    "economics",
    "Incentives, institutions, markets, and public policy.",
    "#65a30d",
  ],
  [
    "Education",
    "education",
    "Teaching, learning, schools, and lifelong curiosity.",
    "#ea580c",
  ],
] as const;

const questionTitles = [
  "What separates AI products people trust from the ones they quickly abandon?",
  "How do experts keep learning when their field changes every month?",
  "Why do database migrations fail in production even when they passed in staging?",
  "Which climate technologies are quietly working at scale right now?",
  "How can a manager give feedback that actually changes behavior?",
  "What makes a product onboarding experience feel respectful rather than manipulative?",
  "How should a small team decide what not to build?",
  "What is the most reliable way to evaluate an AI assistant for daily work?",
  "Why do technically sound security programs still fail inside organizations?",
  "How can cities adapt existing streets to extreme heat?",
  "What does good evidence look like in a fast-moving public debate?",
  "How should engineers communicate uncertainty to non-technical leaders?",
  "Which habits help people retain what they read?",
  "How do healthy teams disagree without slowing every decision?",
  "What makes an online community become more useful over time?",
  "How can early-career designers build judgment without copying trends?",
  "Why are heat pumps such an important part of climate policy?",
  "What should founders understand before introducing usage-based pricing?",
  "How do you know when a software abstraction is earning its complexity?",
  "What is a fair way to measure a teacher's impact?",
  "How can medical professionals correct misinformation without increasing distrust?",
  "What are the warning signs of a brittle data pipeline?",
  "How should product teams run a useful pre-mortem?",
  "What makes career advice durable across economic cycles?",
  "How can organizations make postmortems psychologically safe and operationally useful?",
  "When does personalization make a product worse?",
  "What should every engineer learn about accessibility?",
  "How do strong researchers avoid confirmation bias during interviews?",
  "What policies would help household energy upgrades scale faster?",
  "How should leaders decide what information belongs in a dashboard?",
  "Why do people abandon good habits after a few successful weeks?",
  "What makes a technical explanation memorable?",
  "How can small businesses prepare for a volatile year?",
  "When should a team choose a boring technology?",
  "How do you build credibility when writing outside your formal credentials?",
  "What does responsible experimentation look like in consumer products?",
  "How can schools teach students to evaluate online sources?",
  "Why do some climate solutions struggle despite strong unit economics?",
  "How should a new manager structure their first month?",
  "What is the difference between useful metrics and vanity metrics?",
] as const;

const answerBodies = [
  "Start by making the decision explicit. Teams often jump to tools before agreeing on the outcome, the constraints, and the evidence that would change their mind. A useful process names those three things, runs the smallest credible test, and records what was learned. That makes the result reusable rather than anecdotal.",
  "The most reliable pattern I have seen is progressive commitment. Begin with a reversible step, instrument it well, and increase scope only after the failure modes are understood. This protects learning speed without pretending risk has disappeared. It also creates natural checkpoints for the people affected by the decision.",
  "Context matters more than a universal checklist, but three questions travel well: who bears the downside, how quickly will we notice a mistake, and can the change be reversed? When teams answer those honestly, the right design is usually much less mysterious. The hard part is preserving that honesty under schedule pressure.",
  "Good practice is often operational rather than glamorous. Define ownership, keep the feedback loop short, and make exceptions visible. In mature teams, a surprising result becomes a prompt to update the system—not a reason to blame the person closest to the incident. That is how local lessons become institutional knowledge.",
  "I would separate the leading signal from the final outcome. The outcome tells you whether the work mattered; the leading signal tells you soon enough to respond. Use both, and add a qualitative review so the numbers do not silently redefine the goal. Metrics are strongest when they support judgment instead of replacing it.",
  "A practical first step is to observe the current behavior before proposing a solution. People already have workarounds, informal rules, and signals that the formal process misses. Map those carefully. The best intervention usually preserves what is working while removing one important source of friction at a time.",
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  await prisma.moderationAction.deleteMany();
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.questionFollow.deleteMany();
  await prisma.topicFollow.deleteMany();
  await prisma.userFollow.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.questionTopic.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.mediaAttachment.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hash("DemoPass123!", 12);
  const users = [];
  for (let index = 0; index < userSeeds.length; index += 1) {
    const [name, username, email, bio] = userSeeds[index];
    users.push(
      await prisma.user.create({
        data: {
          name,
          username,
          email,
          bio,
          passwordHash,
          emailVerified: new Date(),
          role:
            index === 1 ? Role.ADMIN : index === 2 ? Role.MODERATOR : Role.USER,
          image: `https://i.pravatar.cc/160?img=${((index * 7) % 70) + 1}`,
          reputation: 180 + index * 137,
          location: index % 2 ? "San Francisco, CA" : "Bengaluru, India",
          occupation: bio.split(" and ")[0],
          preference: {
            create: { theme: index % 3 === 0 ? "dark" : "system" },
          },
        },
      }),
    );
  }

  const topics = [];
  for (const [name, slug, description, color] of topicSeeds)
    topics.push(
      await prisma.topic.create({
        data: {
          name,
          slug,
          description,
          color,
          followerCount: 12000 + topics.length * 18340,
          questionCount: 4,
        },
      }),
    );

  const questions = [];
  const answers = [];
  for (let index = 0; index < questionTitles.length; index += 1) {
    const question = await prisma.question.create({
      data: {
        title: questionTitles[index],
        slug: slugify(questionTitles[index]),
        description:
          "Looking for practical experience, clear reasoning, and evidence that helps people apply the answer in the real world.",
        authorId: users[index % users.length].id,
        viewCount: 840 + index * 731,
        score: 24 + ((index * 37) % 600),
        answerCount: 2,
        createdAt: new Date(Date.now() - index * 6 * 60 * 60 * 1000),
        topics: {
          create: [
            { topicId: topics[index % topics.length].id },
            { topicId: topics[(index + 3) % topics.length].id },
          ],
        },
      },
    });
    questions.push(question);
    for (let answerIndex = 0; answerIndex < 2; answerIndex += 1) {
      const answer = await prisma.answer.create({
        data: {
          questionId: question.id,
          authorId: users[(index + answerIndex + 1) % users.length].id,
          content: `${answerBodies[(index + answerIndex) % answerBodies.length]}\n\nFor “${questionTitles[index]}”, that means testing the advice against the people and constraints in the actual situation, then documenting what changes.`,
          score: 15 + (((index + answerIndex) * 29) % 450),
          commentCount: 2,
          createdAt: new Date(
            Date.now() - (index * 8 + answerIndex) * 60 * 60 * 1000,
          ),
        },
      });
      answers.push(answer);
      const first = await prisma.comment.create({
        data: {
          answerId: answer.id,
          authorId: users[(index + answerIndex + 4) % users.length].id,
          content:
            "This is a useful framing. The emphasis on reversibility makes the recommendation much easier to apply.",
          depth: 0,
        },
      });
      await prisma.comment.create({
        data: {
          answerId: answer.id,
          authorId: users[(index + answerIndex + 6) % users.length].id,
          parentId: first.id,
          content:
            "Agreed. I would also make the review date explicit so the temporary choice does not become permanent by accident.",
          depth: 1,
        },
      });
    }
  }

  for (let index = 0; index < questions.length; index += 1) {
    for (let voter = 0; voter < 5; voter += 1)
      await prisma.vote.create({
        data: {
          userId: users[(index + voter + 2) % users.length].id,
          questionId: questions[index].id,
          value: voter === 4 && index % 4 === 0 ? VoteValue.DOWN : VoteValue.UP,
        },
      });
    await prisma.questionFollow.create({
      data: {
        userId: users[(index + 5) % users.length].id,
        questionId: questions[index].id,
      },
    });
  }
  for (let index = 0; index < answers.length; index += 1) {
    for (let voter = 0; voter < 4; voter += 1)
      await prisma.vote.create({
        data: {
          userId: users[(index + voter + 3) % users.length].id,
          answerId: answers[index].id,
          value: voter === 3 && index % 5 === 0 ? VoteValue.DOWN : VoteValue.UP,
        },
      });
  }
  for (let index = 0; index < users.length - 1; index += 1)
    await prisma.userFollow.create({
      data: {
        followerId: users[index].id,
        followingId: users[(index + 1) % users.length].id,
      },
    });
  for (let index = 0; index < topics.length; index += 1) {
    await prisma.topicFollow.create({
      data: {
        userId: users[index % users.length].id,
        topicId: topics[index].id,
      },
    });
    await prisma.topicFollow.create({
      data: {
        userId: users[(index + 3) % users.length].id,
        topicId: topics[index].id,
      },
    });
  }
  for (let index = 0; index < 12; index += 1)
    await prisma.bookmark.create({
      data: {
        userId: users[index % users.length].id,
        questionId: questions[(index * 3) % questions.length].id,
      },
    });

  for (let index = 0; index < 20; index += 1)
    await prisma.notification.create({
      data: {
        recipientId: users[index % 3].id,
        actorId: users[(index + 4) % users.length].id,
        questionId: questions[index % questions.length].id,
        type: [
          NotificationType.NEW_FOLLOWER,
          NotificationType.NEW_ANSWER,
          NotificationType.UPVOTE,
          NotificationType.MENTION,
        ][index % 4],
        message: [
          "started following you",
          "answered a question you follow",
          "upvoted your contribution",
          "mentioned you in an answer",
        ][index % 4],
        readAt: index > 8 ? new Date() : null,
        createdAt: new Date(Date.now() - index * 45 * 60 * 1000),
      },
    });
  for (let index = 0; index < 8; index += 1)
    await prisma.report.create({
      data: {
        reporterId: users[(index + 5) % users.length].id,
        answerId: answers[index * 3].id,
        reason: [
          ReportReason.SPAM,
          ReportReason.HARASSMENT,
          ReportReason.MISINFORMATION,
          ReportReason.COPYRIGHT,
        ][index % 4],
        details:
          "Please review this contribution in context. The cited claims may not meet the community standard.",
        status: index < 6 ? "PENDING" : "REVIEWING",
      },
    });

  console.info(
    `Seeded ${users.length} users, ${topics.length} topics, ${questions.length} questions, and ${answers.length} answers.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
