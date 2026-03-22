import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create a default team for testing
  const team =
    (await prisma.team.findFirst({ where: { key: 'DEV' } })) ??
    (await prisma.team.create({ data: { name: 'Development Team', key: 'DEV' } }))

  console.log(`✅ Created team: ${team.name}`)

  // Create default workflow states
  const workflowStates = [
    { name: 'Backlog', type: 'backlog', color: '#64748b', position: 0 },
    { name: 'Todo', type: 'unstarted', color: '#8b5cf6', position: 1 },
    { name: 'In Progress', type: 'started', color: '#3b82f6', position: 2 },
    { name: 'Done', type: 'completed', color: '#10b981', position: 3 },
    { name: 'Canceled', type: 'canceled', color: '#ef4444', position: 4 },
  ]

  for (const state of workflowStates) {
    await prisma.workflowState.upsert({
      where: { id: `seed-${team.id}-${state.name}` },
      update: {},
      create: {
        id: `seed-${team.id}-${state.name}`,
        ...state,
        teamId: team.id,
      },
    })
  }

  console.log('✅ Created workflow states')

  // Create default labels
  const labels = [
    { name: 'Bug', color: '#ef4444' },
    { name: 'Feature', color: '#3b82f6' },
    { name: 'Enhancement', color: '#10b981' },
    { name: 'Documentation', color: '#8b5cf6' },
    { name: 'Performance', color: '#f59e0b' },
    { name: 'Security', color: '#dc2626' },
  ]

  for (const label of labels) {
    await prisma.label.upsert({
      where: { teamId_name: { teamId: team.id, name: label.name } },
      update: {},
      create: {
        ...label,
        teamId: team.id,
      },
    })
  }

  console.log('✅ Created labels')

  // Create a sample project
  const project = await prisma.project.upsert({
    where: { teamId_key: { teamId: team.id, key: 'WEB' } },
    update: {},
    create: {
      name: 'Web Application',
      description: 'Main web application project',
      key: 'WEB',
      color: '#6366f1',
      icon: '🌐',
      teamId: team.id,
    },
  })

  console.log(`✅ Created project: ${project.name}`)

  console.log('🎉 Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
