import { Liquid, Drop } from '../../../../src/liquid'
import { expect } from 'chai'
import { mock, restore } from '../../../stub/mockfs'

describe('tags/render', function () {
  let liquid: Liquid
  before(function () {
    liquid = new Liquid({
      root: '/',
      extname: '.html'
    })
  })
  afterEach(restore)
  it('should support render', async function () {
    mock({
      '/current.html': 'bar{% render "bar/foo.html" %}bar',
      '/bar/foo.html': 'foo'
    })
    const html = await liquid.renderFile('/current.html')
    return expect(html).to.equal('barfoobar')
  })
  it('should support template string', async function () {
    mock({
      '/current.html': 'bar{% render "bar/{{name}}" %}bar',
      '/bar/foo.html': 'foo'
    })
    const html = await liquid.renderFile('/current.html', { name: 'foo.html' })
    return expect(html).to.equal('barfoobar')
  })

  it('should throw when not specified', function () {
    mock({
      '/parent.html': '{%render%}'
    })
    return liquid.renderFile('/parent.html').catch(function (e) {
      console.log(e)
      expect(e.name).to.equal('RenderError')
      expect(e.message).to.match(/cannot render with empty filename/)
    })
  })

  it('should throw when not exist', function () {
    mock({
      '/parent.html': '{%render not-exist%}'
    })
    return liquid.renderFile('/parent.html').catch(function (e) {
      expect(e.name).to.equal('RenderError')
      expect(e.message).to.match(/cannot render with empty filename/)
    })
  })

  it('should support render with relative path', async function () {
    mock({
      '/bar/foo.html': 'foo',
      '/foo/relative.html': 'bar{% render "../bar/foo.html" %}bar'
    })
    const html = await liquid.renderFile('foo/relative.html')
    return expect(html).to.equal('barfoobar')
  })

  it('should support render: hash list', async function () {
    mock({
      '/hash.html': '{% assign name="harttle" %}{% render "user.html", role: "admin", alias: name %}',
      '/user.html': '{{role}} : {{alias}}'
    })
    const html = await liquid.renderFile('hash.html')
    return expect(html).to.equal('admin : harttle')
  })

  it('should not bleed into child template', async function () {
    mock({
      '/hash.html': '{% assign name="harttle" %}InParent: {{name}} {% render "user.html" %}',
      '/user.html': 'InChild: {{name}}'
    })
    const html = await liquid.renderFile('hash.html')
    return expect(html).to.equal('InParent: harttle InChild: ')
  })

  it('should be able to access globals', async function () {
    mock({
      '/hash.html': 'InParent: {{name}} {% render "user.html" %}',
      '/user.html': 'InChild: {{name}}'
    })
    const html = await liquid.renderFile('hash.html', {
      name: 'harttle'
    }, {
      globals: { name: 'Harttle' }
    })
    return expect(html).to.equal('InParent: harttle InChild: Harttle')
  })

  it('should support render: with', async function () {
    mock({
      '/with.html': '{% render "color" with "red", shape: "rect" %}',
      '/color.html': 'color:{{color}}, shape:{{shape}}'
    })
    const html = await liquid.renderFile('with.html')
    return expect(html).to.equal('color:red, shape:rect')
  })
  it('should support render: with as Drop', async function () {
    class ColorDrop extends Drop {
      public valueOf (): string {
        return 'red!'
      }
    }
    mock({
      '/with.html': '{% render "color" with color %}',
      '/color.html': 'color:{{color}}'
    })
    const html = await liquid.renderFile('with.html', { color: new ColorDrop() })
    expect(html).to.equal('color:red!')
  })
  it('should support render: with passed as Drop', async function () {
    class ColorDrop extends Drop {
      public valueOf (): string {
        return 'red!'
      }
    }
    liquid.registerFilter('name', x => x.constructor.name)
    mock({
      '/with.html': '{% render "color" with color %}',
      '/color.html': '{{color | name}}'
    })
    const html = await liquid.renderFile('with.html', { color: new ColorDrop() })
    expect(html).to.equal('ColorDrop')
  })

  it('should support nested renders', async function () {
    mock({
      '/personInfo.html': 'This is a person {% render "card.html", person: person%}',
      '/card.html': '<p>{{person.firstName}} {{person.lastName}}<br/>{% render "address", address: person.address %}</p>',
      '/address.html': 'City: {{address.city}}'
    })
    const ctx = {
      person: {
        firstName: 'Joe',
        lastName: 'Shmoe',
        address: {
          city: 'Dallas'
        }
      }
    }
    const html = await liquid.renderFile('personInfo.html', ctx)
    return expect(html).to.equal('This is a person <p>Joe Shmoe<br/>City: Dallas</p>')
  })

  describe('static partial', function () {
    it('should support filename with extention', async function () {
      mock({
        '/parent.html': 'X{% render child.html color:"red" %}Y',
        '/child.html': 'child with {{color}}'
      })
      const staticLiquid = new Liquid({ dynamicPartials: false, root: '/' })
      const html = await staticLiquid.renderFile('parent.html')
      return expect(html).to.equal('Xchild with redY')
    })

    it('should support parent paths', async function () {
      mock({
        '/parent.html': 'X{% render bar/./../foo/child.html %}Y',
        '/foo/child.html': 'child'
      })
      const staticLiquid = new Liquid({ dynamicPartials: false, root: '/' })
      const html = await staticLiquid.renderFile('parent.html')
      return expect(html).to.equal('XchildY')
    })

    it('should support subpaths', async function () {
      mock({
        '/parent.html': 'X{% render foo/child.html %}Y',
        '/foo/child.html': 'child'
      })
      const staticLiquid = new Liquid({ dynamicPartials: false, root: '/' })
      const html = await staticLiquid.renderFile('parent.html')
      return expect(html).to.equal('XchildY')
    })

    it('should support comma separated arguments', async function () {
      mock({
        '/parent.html': 'X{% render child.html, color:"red" %}Y',
        '/child.html': 'child with {{color}}'
      })
      const staticLiquid = new Liquid({ dynamicPartials: false, root: '/' })
      const html = await staticLiquid.renderFile('parent.html')
      return expect(html).to.equal('Xchild with redY')
    })
  })
  describe('sync support', function () {
    it('should support quoted string', function () {
      mock({
        '/current.html': 'bar{% render "bar/foo.html" %}bar',
        '/bar/foo.html': 'foo'
      })
      const html = liquid.renderFileSync('/current.html')
      return expect(html).to.equal('barfoobar')
    })
    it('should support template string', function () {
      mock({
        '/current.html': 'bar{% render name" %}bar',
        '/bar/foo.html': 'foo'
      })
      const html = liquid.renderFileSync('/current.html', { name: '/bar/foo.html' })
      return expect(html).to.equal('barfoobar')
    })
    it('should support render: with', function () {
      mock({
        '/with.html': '{% render "color" with "red", shape: "rect" %}',
        '/color.html': 'color:{{color}}, shape:{{shape}}'
      })
      const html = liquid.renderFileSync('with.html')
      return expect(html).to.equal('color:red, shape:rect')
    })
    it('should support filename with extention', function () {
      mock({
        '/parent.html': 'X{% render child.html color:"red" %}Y',
        '/child.html': 'child with {{color}}'
      })
      const staticLiquid = new Liquid({ dynamicPartials: false, root: '/' })
      const html = staticLiquid.renderFileSync('parent.html')
      return expect(html).to.equal('Xchild with redY')
    })
  })
})
