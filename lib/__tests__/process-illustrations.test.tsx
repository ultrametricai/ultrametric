// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
import { processIllustration } from '../shared-processes/process-illustrations'
import { loadSharedProcesses } from '../shared-processes/load'
import bindings from '../shared-processes/index-icons.json'

const records = loadSharedProcesses()

it('provides original-size, inert SVG variants for every registered stable process ID', () => {
  expect(Object.keys(bindings)).toHaveLength(123)
  for (const id of Object.keys(bindings)) {
    const variants = processIllustration(id)!
    expect(variants, id).toBeDefined()
    for (const [variant, size] of [['mobile', 64], ['desktop', 512]] as const) {
      const svg = new DOMParser().parseFromString(readFileSync(`public${variants[variant]}`, 'utf8'), 'image/svg+xml')
      expect(svg.querySelector('parsererror'), id).toBeNull()
      expect(svg.documentElement.tagName).toBe('svg')
      expect(svg.documentElement.getAttribute('width')).toBe(String(size))
      expect(svg.documentElement.getAttribute('height')).toBe(String(size))
      const viewBox = svg.documentElement.getAttribute('viewBox')!.split(/\s+/).map(Number)
      expect(viewBox.slice(0, 2)).toEqual([0, 0])
      expect(viewBox[2]).toBeGreaterThan(0)
      expect(viewBox[3]).toBe(viewBox[2])
      expect(svg.querySelector('script, foreignObject, iframe, object, embed, image, use, a, animate, set, style')).toBeNull()
      for (const node of svg.querySelectorAll('*')) for (const attribute of node.attributes) {
        expect(attribute.name).not.toMatch(/^on/i)
        expect(attribute.name).not.toMatch(/(?:^|:)href$/i)
        expect(attribute.value).not.toMatch(/url\s*\(|javascript:|data:/i)
      }
    }
  }
  expect(processIllustration('form_001')).toEqual({ desktop: '/process-icons/incorporate.svg', mobile: '/process-icons/incorporate-64.svg' })
})

it('renders each registered header with its 64/512 pair and leaves all unregistered records text-only', () => {
  const registered = records.filter(record => processIllustration(record.id))
  const unregistered = records.filter(record => !processIllustration(record.id))
  expect(registered).toHaveLength(123)
  expect(unregistered).toHaveLength(50)
  for (const record of records) {
    const root = document.createElement('div')
    root.innerHTML = renderToStaticMarkup(<SharedProcessReader record={record} records={records} />)
    const header = root.querySelector('header')!
    expect(header.querySelector('h1')?.textContent).toBe(record.title)
    const variants = processIllustration(record.id)
    const images = [...header.querySelectorAll(':scope > img, :scope > div > img')]
    expect(images, record.id).toHaveLength(variants ? 2 : 0)
    if (variants) {
      expect(images.map(image => [image.getAttribute('src'), image.getAttribute('width'), image.getAttribute('height'), image.getAttribute('alt')])).toEqual([[variants.mobile, '64', '64', ''], [variants.desktop, '256', '256', '']])
      expect(images[0].className).toContain('md:hidden')
      expect(images[1].className).toContain('md:block')
    } else {
      expect(header.className).not.toContain('md:grid-cols-')
    }
  }
  for (const id of ['fund_007', 'first-hire', 'missing', '__proto__', 'constructor']) expect(processIllustration(id)).toBeUndefined()
})
