import { fetchPR, IAPIPR } from './api'

const PlaceholderChangeType = '???'
const OfficialOwner = 'desktop'

interface IParsedCommit {
  readonly prID: number
  readonly owner: string
}

function parseCommitTitle(line: string): IParsedCommit {
  // E.g.: Merge pull request #2424 from desktop/fix-shrinkwrap-file
  const re = /^Merge pull request #(\d+) from (.+?)\/.*$/
  const matches = line.match(re)
  if (!matches || matches.length !== 3) {
    throw new Error(`Unable to parse '${line}'`)
  }

  const id = parseInt(matches[1], 10)
  if (isNaN(id)) {
    throw new Error(`Unable to parse PR number from '${line}': ${matches[1]}`)
  }

  return {
    prID: id,
    owner: matches[2],
  }
}

function capitalized(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getChangelogEntry(commit: IParsedCommit, pr: IAPIPR): string {
  let issueRef = ''
  let type = PlaceholderChangeType
  const description = capitalized(pr.title)

  const re = /Fixes #(\d+)/gi
  let match
  do {
    match = re.exec(pr.body)
    if (match && match.length > 1) {
      issueRef += ` #${match[1]}`
    }
  } while (match)

  if (issueRef.length) {
    type = 'Fixed'
  } else {
    issueRef = ` #${commit.prID}`
  }

  let attribution = ''
  if (commit.owner !== OfficialOwner) {
    attribution = `. Thanks @${commit.owner}!`
  }

  return `[${type}] ${description} -${issueRef}${attribution}`
}

export async function getChangelogEntries(
  lines: ReadonlyArray<string>
): Promise<ReadonlyArray<string>> {
  const entries = []
  for (const line of lines) {
    try {
      const commit = parseCommitTitle(line)
      const pr = await fetchPR(commit.prID)
      if (!pr) {
        throw new Error(`Unable to get PR from API: ${commit.prID}`)
      }

      const entry = getChangelogEntry(commit, pr)
      entries.push(entry)
    } catch (e) {
      console.warn('Unable to parse line, using the full message.', e)

      entries.push(`[${PlaceholderChangeType}] ${line}`)
    }
  }

  return entries
}