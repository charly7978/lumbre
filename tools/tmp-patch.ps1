$p = "lib/agents.mjs"
$s = Get-Content -Raw -Encoding utf8 $p
$old = @"
    expects: 'object',
    attempts: 3,
  }));
"@
$new = @"
    expects: 'object',
    attempts: ['compliance', 'redteam', 'synthesis', 'outreach'].includes(stepId) ? 4 : 3,
  }));
"@
$count = ([regex]::Matches($s, [regex]::Escape($old))).Count
Write-Host "matches:" $count
$s = $s.Replace($old, $new)
Set-Content -Encoding utf8 -NoNewline $p $s
