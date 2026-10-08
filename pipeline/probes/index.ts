// Local probe registry: one module per arena (pipeline/probes/<arena-id>.ts) so parallel
// arena waves never collide in a single literal. To add probes for an arena, edit (or
// create) its module, register it here, and bump EXPECTED counts in
// pipeline/__tests__/probes.test.ts.
//
// Every command here is cheap, keyless, and read-only: --version/--help prints and stdio MCP
// initialize handshakes. Nothing installs, mutates state, or needs credentials.
//
// Imports are explicit (no fs discovery) so the registry stays statically analyzable and
// works under tsx.
import type { LocalProbe } from './types'
import { probes as payments } from './payments'
import { probes as accounting } from './accounting'
import { probes as agentFrameworks } from './agent-frameworks'
import { probes as agentSandboxes } from './agent-sandboxes'
import { probes as aiCoding } from './ai-coding'
import { probes as securityScanners } from './security-scanners'
import { probes as terminals } from './terminals'
import { probes as packageManagers } from './package-managers'
import { probes as mcpInfrastructure } from './mcp-infrastructure'
import { probes as browserAgents } from './browser-agents'
import { probes as vectorDatabases } from './vector-databases'
import { probes as workflowAutomation } from './workflow-automation'
import { probes as observability } from './observability'
import { probes as infraAsCode } from './infra-as-code'
import { probes as aiMemory } from './ai-memory'
import { probes as voiceAgents } from './voice-agents'
import { probes as notesKnowledge } from './notes-knowledge'
import { probes as meetingAi } from './meeting-ai'
import { probes as gpuClouds } from './gpu-clouds'
import { probes as featureFlags } from './feature-flags'
import { probes as serverlessDatabases } from './serverless-databases'
import { probes as agentSkills } from './agent-skills'
import { probes as dataWarehouses } from './data-warehouses'
import { probes as incidentManagement } from './incident-management'
import { probes as dataPipelines } from './data-pipelines'
import { probes as docsPlatforms } from './docs-platforms'
import { probes as customerDataPlatforms } from './customer-data-platforms'
import { probes as ecommercePlatforms } from './ecommerce-platforms'
import { probes as email } from './email'
import { probes as searchInfra } from './search-infra'
import { probes as scheduling } from './scheduling'
import { probes as designTools } from './design-tools'
import { probes as teamChat } from './team-chat'
import { probes as softwareFactory } from './software-factory'
import { probes as vibeCoding } from './vibe-coding'
import { probes as aiSupportAgents } from './ai-support-agents'
import { probes as durableWorkflows } from './durable-workflows'
import { probes as aiCodeReview } from './ai-code-review'
import { probes as documentExtraction } from './document-extraction'
import { probes as legalOps } from './legal-ops'
import { probes as apiPlatforms } from './api-platforms'
import { probes as modelGateways } from './model-gateways'
import { probes as emailMarketing } from './email-marketing'
import { probes as equityManagement } from './equity-management'
import { probes as aiAssistants } from './ai-assistants'
import { probes as aiResearchAgents } from './ai-research-agents'
import { probes as errorTracking } from './error-tracking'
import { probes as expenseManagement } from './expense-management'
import { probes as billingSubscriptions } from './billing-subscriptions'
import { probes as fraudPrevention } from './fraud-prevention'
import { probes as llmEvalsObservability } from './llm-evals-observability'
import { probes as webScraping } from './web-scraping'
import { probes as agenticCommerce } from './agentic-commerce'
import { probes as cardIssuing } from './card-issuing'
import { probes as taxAutomation } from './tax-automation'
import { probes as bankingAsAService } from './banking-as-a-service'
import { probes as marketplacePayments } from './marketplace-payments'
import { probes as processors } from './processors'
import { probes as gpus } from './gpus'
import { probes as securityKeys } from './security-keys'
import { probes as selfHostedAssistants } from './self-hosted-assistants'
import { probes as authenticatorApps } from './authenticator-apps'
import { probes as gameEngines } from './game-engines'
import { probes as governmentServices } from './government-services'
import { probes as identityVerification } from './identity-verification'
import { probes as bankingDataApis } from './banking-data-apis'
import { probes as stablecoinPayments } from './stablecoin-payments'
import { probes as backendAsAService } from './backend-as-a-service'
import { probes as edgePlatforms } from './edge-platforms'
import { probes as productAnalytics } from './product-analytics'
import { probes as frontierModels } from './frontier-models'
import { probes as applicantTracking } from './applicant-tracking'
import { probes as complianceAutomation } from './compliance-automation'
import { probes as domainRegistrars } from './domain-registrars'
import { probes as ssoIdentity } from './sso-identity'
import { probes as cloudPlatforms } from './cloud-platforms'
import { probes as cloudStorage } from './cloud-storage'
import { probes as emailApis } from './email-apis'
import { probes as virtualMailboxes } from './virtual-mailboxes'
import { probes as payroll } from './payroll'

export type { LocalProbe } from './types'

export const LOCAL_PROBES: Record<string, LocalProbe[]> = {
  payments,
  accounting,
  'agent-frameworks': agentFrameworks,
  'agent-sandboxes': agentSandboxes,
  'ai-coding': aiCoding,
  'security-scanners': securityScanners,
  terminals,
  'package-managers': packageManagers,
  'mcp-infrastructure': mcpInfrastructure,
  'browser-agents': browserAgents,
  'vector-databases': vectorDatabases,
  'workflow-automation': workflowAutomation,
  observability,
  'infra-as-code': infraAsCode,
  'ai-memory': aiMemory,
  'voice-agents': voiceAgents,
  'notes-knowledge': notesKnowledge,
  'meeting-ai': meetingAi,
  'gpu-clouds': gpuClouds,
  'feature-flags': featureFlags,
  'serverless-databases': serverlessDatabases,
  'agent-skills': agentSkills,
  'data-warehouses': dataWarehouses,
  'incident-management': incidentManagement,
  'data-pipelines': dataPipelines,
  'docs-platforms': docsPlatforms,
  'customer-data-platforms': customerDataPlatforms,
  'ecommerce-platforms': ecommercePlatforms,
  email,
  'search-infra': searchInfra,
  scheduling,
  'design-tools': designTools,
  'team-chat': teamChat,
  'software-factory': softwareFactory,
  'vibe-coding': vibeCoding,
  'ai-support-agents': aiSupportAgents,
  'durable-workflows': durableWorkflows,
  'ai-code-review': aiCodeReview,
  'document-extraction': documentExtraction,
  'legal-ops': legalOps,
  'api-platforms': apiPlatforms,
  'model-gateways': modelGateways,
  'email-marketing': emailMarketing,
  'equity-management': equityManagement,
  'ai-assistants': aiAssistants,
  'ai-research-agents': aiResearchAgents,
  'error-tracking': errorTracking,
  'expense-management': expenseManagement,
  'billing-subscriptions': billingSubscriptions,
  'fraud-prevention': fraudPrevention,
  'llm-evals-observability': llmEvalsObservability,
  'web-scraping': webScraping,
  'agentic-commerce': agenticCommerce,
  'card-issuing': cardIssuing,
  'tax-automation': taxAutomation,
  'banking-as-a-service': bankingAsAService,
  'marketplace-payments': marketplacePayments,
  processors,
  gpus,
  'security-keys': securityKeys,
  'self-hosted-assistants': selfHostedAssistants,
  'authenticator-apps': authenticatorApps,
  'game-engines': gameEngines,
  'government-services': governmentServices,
  'identity-verification': identityVerification,
  'banking-data-apis': bankingDataApis,
  'stablecoin-payments': stablecoinPayments,
  'backend-as-a-service': backendAsAService,
  'edge-platforms': edgePlatforms,
  'product-analytics': productAnalytics,
  'frontier-models': frontierModels,
  'applicant-tracking': applicantTracking,
  'compliance-automation': complianceAutomation,
  'domain-registrars': domainRegistrars,
  'sso-identity': ssoIdentity,
  'cloud-platforms': cloudPlatforms,
  'cloud-storage': cloudStorage,
  'email-apis': emailApis,
  'virtual-mailboxes': virtualMailboxes,
  payroll,
}
