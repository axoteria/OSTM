Player = {
	toSave: ['health', 'mana', 'weaponName'],

	health: 100,
	baseHealthRegen: 5,
	partialHealth: 0, //health regen per-tick roundoff

	mana: 100,
	baseMaxMana: 100,
	baseManaRegen: 8,
	partialMana: 0,

	weaponName: 'knife',
	weapon: null,

	attackName: 'attack',
	attack: null,

	armor: 2,

	randDamage: 0.3,
	critDamage: 150,

	stats: [],
	resources: ['xp', 'skill', 'gold', 'research', 'iron', 'wood'],

	init: function() {
		var stats = loadStats();
		for (var key in stats) {
			this.stats.push(key);
			this[key] = stats[key];
			this.toSave.push(key);
		}

		foreach (this.resources, function(resource) {
			Player[resource] = {
				toSave: ['amount'],
				amount: 0,
				partial: 0,
				perSecond: 0,
				unlocked: false,
				unlockBuilding: ''
			};
			Player.toSave.push(resource);
		});
		this.xp.unlocked = true;
		this.gold.unlocked = true;
		this.skill.unlockBuilding = 'training-hall';
		this.research.unlockBuilding = 'research-center';
		this.iron.unlockBuilding = 'forge';
		this.wood.unlockBuilding = 'logger';

		this.createStatButtons();

		var statStr = '<div>Level: <span id="stat-level"></span></div>';
		foreach (this.resources, function(resource) {
			statStr += '<div id="' + resource + '-stat">' + getIconHtml(resource) +
				': <span id="' + resource + '-amount"></span></div>';
		});
		statStr += 
			'<div id="resources"></div>' +
			'<br>' +
			'<div>Weapon : <span id="stat-weapon"></span></div>' +
			'<div>Skill : <span id="stat-skill"></span></div>' +
			'<br>' +
			'<div>Damage : <span id="stat-damage"></span></div>' +
			'<br>' +
			'<div>Crit. Chance : <span id="stat-crit"></span></div>' +
			'<div>Crit Damage : <span id="stat-crit-damage"></span></div>' +
			'<br>' +
			'<div>Spell Power : <span id="stat-spellpower"></span></div>' +
			'<div>Defense Power : <span id="stat-defense"></span></div>' +
			'<br>' +
			'<div>Armor : <span id="stat-armor"></span></div>' +
			'<br>' +
			'<div>Health Regen: <span id="stat-regen"></span></div>' +
			'<div>Mana Regen: <span id="stat-mana-regen"></span></div>' +
			'<div>Damage Reduction: <span id="stat-reduction"></span></div>' +
			'<br>';

		j("#stats").html(statStr);

		this.refreshResourceProduction();
		this.update();
	},

	update: function() {
		this.weapon = Blacksmith.getWeapon(this.weaponName);
		this.attack = Skills.getSkill(this.attackName);

		var dT = Game.dT;
		this.regenHealth(this.getHealthRegen() * dT);
		this.regenMana(this.getManaRegen() * dT);

		j('#player-health', 'text', formatNumber(this.health) + ' / ' + formatNumber(this.getMaxHealth()));
		j('#player-health', 'css', 'width', this.health / this.getMaxHealth() * 100 + '%');
		j('#player-mana', 'text', formatNumber(this.mana) + ' / ' + formatNumber(this.getMaxMana()));
		j('#player-mana', 'css', 'width', this.mana / this.getMaxMana() * 100 + '%');

		this.updateResources();
		this.updateStats();
		this.updateStatButtons();
	},

	updateResources: function() {
		var dT = Game.dT;

		foreach (this.resources, function(resource) {
			var r = Player[resource];
			r.partial += r.perSecond * dT;
			var whole = Math.floor(r.partial);
			r.amount += whole;
			r.partial -= whole;
		});
	},

	refreshResourceProduction: function() {
		foreach (this.resources, function(r) {
			var resource = Player[r];
			resource.perSecond = 0;
			if (!resource.unlocked) {
				var building = Village.buildings[resource.unlockBuilding];
				if (building && building.count > 0) {
					resource.unlocked = true;
				}
			}
		});

		foreach (Village.buildings, function(building) {
			if (building.resourceProduced) {
				Player[building.resourceProduced].perSecond +=
					building.count * building.getProduction();
			}
		});
	},

	canSpend: function(name, cost) {
		return this[name] && this[name].amount >= cost;
	},

	spend: function(name, cost, onSucceed) {
		if (this.canSpend(name, cost)) {
			this[name].amount -= cost;
			if (onSucceed) {
				onSucceed();
			}
			return true;
		}
		return false;
	},

	giveResources: function(resources) {
		foreach (resources, function(val, name) {
			if (Player[name]) {
				Player[name].amount += val;
			}
		});
	},

	updateStats: function() {
		j('#stat-level', 'text', formatNumber(Player.getLevel()));

		var resourceHtml = '';
		foreach (this.resources, function(resource){
			var r = Player[resource];
			j('#' + resource + '-stat', 'toggle', r.unlocked);

			var amtStr = formatNumber(r.amount);
			if (r.perSecond > 0) {
				amtStr += ' (+' + formatNumber(r.perSecond) + '/s)';
			}
			j('#' + resource + '-amount', 'text', amtStr);
		});

		j('#stat-weapon', 'text', this.weapon.getName());
		j('#stat-skill', 'text', this.attack.displayName);

		var dmg = this.getDamageInfo();
		j('#stat-damage', 'text', formatNumber(dmg.lo) + ' - ' + formatNumber(dmg.hi));

		j('#stat-crit', 'text', formatNumber(dmg.crit) + '%');
		j('#stat-crit-damage', 'text', formatNumber(this.getCritDamage()) + '%');

		j('#stat-spellpower', 'text', formatNumber(dmg.spellPower));
		j('#stat-defense', 'text', formatNumber(this.getDefensePower()));

		j('#stat-armor', 'text', formatNumber(Player.armor));

		j('#stat-regen', 'text', '+' + formatNumber(this.getHealthRegen()) + '/s');
		j('#stat-mana-regen', 'text', '+' + formatNumber(this.getManaRegen()) + '/s');
		j('#stat-reduction', 'text', formatNumber(100 * (1 - this.defenseDamageMultiplier())) + '%');
	},

	getStat: function(i) {
		return this[this.stats[i]];
	},

	getLevel: function() {
		var level = 1;
		for (var i = 0; i < this.stats.length; i++) {
			level += this.getStat(i).level;
		}
		return level;
	},

	regenHealth: function(amount) {
		this.partialHealth += amount;
		var restored = Math.floor(this.partialHealth);
		this.partialHealth -= restored;
		this.health = Math.min(this.health + restored, this.getMaxHealth());
		return restored;
	},

	regenMana: function(amount) {
		this.partialMana += amount;
		var restored = Math.floor(this.partialMana);
		this.partialMana -= restored;
		this.mana = Math.min(this.mana + restored, this.getMaxMana());
		return restored;
	},

	addHealth: function(amount) {
		this.regenHealth(amount);
		this.createAddHealthParticle(amount);
	},

	getMaxHealth: function() {
		return Math.floor(this.weapon.getMult('maxHealth') *
			Skills.getPassiveMult('maxHealth') *
			this.maxHealth.value());
	},

	getMaxMana: function() {
		return Math.floor(this.weapon.getMult('maxMana') *
			Skills.getPassiveMult('maxMana') *
			this.maxMana.value());
	},

	getHealthRegen: function() {
		return this.weapon.getMult('healthRegen') *
			Skills.getPassiveMult('healthRegen') *
			(this.baseHealthRegen +
				Skills.getPassiveBase('healthRegen') / 100 * this.getMaxHealth());
	},

	getManaRegen: function() {
		return this.weapon.getMult('manaRegen') *
			Skills.getPassiveMult('manaRegen') *
			(this.baseManaRegen +
				Skills.getPassiveBase('manaRegen') / 100 * this.getMaxMana());
	},

	getDamageInfo: function() {
		var dmg = {
			attackPower: this.weapon.getDamage() *
				this.attack.getDamage() / 100 *
				Skills.getPassiveMult('damage'),
			spellPower: Math.floor(this.weapon.getMult('spellPower') *
				Skills.getPassiveMult('spellPower') *
				(94 + 2 * this.intelligence.value() + this.weapon.getSpellPower())),
			crit: (this.weapon.getBaseCrit() + Skills.getPassiveBase('crit')) *
				this.weapon.getMult('crit') *
				Skills.getPassiveMult('crit'),
			isSpell: this.attack.category === 'Spell',
		};
		dmg.baseDamage = dmg.attackPower;
		if (dmg.isSpell) {
			dmg.baseDamage = (dmg.spellPower / 100) * this.attack.getDamage();
		}

		dmg.lo = Math.ceil(dmg.baseDamage * (1 - this.randDamage / 2));
		dmg.hi = Math.floor(dmg.baseDamage * (1 + this.randDamage / 2));
		dmg.isCrit = !dmg.isSpell && rand(0, 100) < dmg.crit;
		dmg.damage = randIntInc(dmg.lo, dmg.hi);
		if (dmg.isCrit) {
			dmg.damage = Math.floor(dmg.damage * this.getCritDamage() / 100);
		}
		return dmg;
	},

	getCritDamage: function() {
		return this.weapon.getUpgradeAmount('critDamage') +
			Skills.getPassiveBase('critDamage') +
			this.critDamage;
	},

	getDefensePower: function() {
		return Math.floor(this.weapon.getMult('defense') *
			Skills.getPassiveMult('defense') *
			(12 + this.defense.value() * 6 + this.getLevel()));
		
	},

	defenseDamageMultiplier: function() {
		return 40 / (40 + this.getDefensePower());
	},

	tryAttack: function(enemy) {
		var baseDamage = enemy.attackPower();
		var modifiedDamage = Math.ceil(baseDamage * this.defenseDamageMultiplier()) -
			this.armor;
		modifiedDamage = Math.max(modifiedDamage, 1);
		if (enemy.isActive() &&
				this.mana >= this.attack.manaCost &&
				this.health > modifiedDamage) {
			this.spendMana(this.attack.manaCost);
			this.takeDamage(modifiedDamage);
			enemy.takeDamage(this.getDamageInfo());

			if (this.mana < this.attack.manaCost) {
				this.attackName  = 'attack';
			}
		}
	},

	takeDamage: function(damage) {
		this.health -= damage;
		this.createAddHealthParticle(-damage);
	},

	spendMana: function(cost) {
		this.mana -= cost;

		if (cost > 0) {
			this.createAddManaParticle(-cost);
		}
	},

	createAddHealthParticle: function(healthAmt) {
		var healthBar = j('#player-health');
		var pos = healthBar.position();
		var width = healthBar.width();
		var height = healthBar.height();
		var x = pos.left + width - 8;
		var y = pos.top + height / 2;

		var particleType = healthAmt > 0 ? healParticleType : playerDamageParticleType;
		var sign = healthAmt > 0 ? '+' : '';

		ParticleContainer.create(particleType, sign + formatNumber(healthAmt), x, y);
	},

	createAddManaParticle: function(manaAmt) {
		var manaBar = j('#player-mana');
		var pos = manaBar.position();
		var width = manaBar.width();
		var height = manaBar.height();
		var x = pos.left + width - 8;
		var y = pos.top + height / 2;

		var sign = manaAmt > 0 ? '+' : '';

		ParticleContainer.create(manaParticleType, sign + formatNumber(manaAmt), x, y);
	},

	upgrade: function(name) {
		for (var i = 0; i < this.stats.length; i++) {
			var stat = this.getStat(i);
			if (stat.name == name) {
				stat.tryUpgrade();
			}
		}
	},

	createStatButtons: function() {
		var statHtml = '';
		for (var i = 0; i < this.stats.length; i++) {
			statHtml += this.getStat(i).getUpgradeButtonHtml() + '<br/>';
		}

		$('#stat-buttons').html(statHtml);
		this.updateStatButtons();
	},

	updateStatButtons: function() {
		for (var i = 0; i < this.stats.length; i++) {
			this.getStat(i).updateButton();
		}
	},

	statUpgradeBaseCost: function() {
		var level = this.getLevel();
		return Math.floor(0.5 * (level - 1) + 0.2 * Math.pow(level - 1, 2.3));
	}
};

function StatType(data) {
	this.toSave = ['level'];

	this.name = data.name || '';
	this.displayName = data.displayName || this.name || '';
	this.abbrev = data.abbrev || this.displayName || '';
	this.minLevel = data.minLevel || 0;
	this.baseValue = data.baseValue || 0;
	this.levelValue = data.levelValue || 1;
	this.isPercent = data.isPercent || false;
	this.stringPostfix = data.stringPostfix || '';

	this.level = 0;

	this.value = function() {
		var val = this.getBaseValue();
		if (this.isPercent) {
			val *= 0.01;
		}
		return val;
	};

	this.getBaseValue = function() {
		return this.getBaseValueAtLevel(this.level);
	};

	this.getBaseValueAtLevel = data.getBaseValueAtLevel || function(level) {
		return this.baseValue + level * this.levelValue;
	};

	this.getStringPostfix = function() {
		return this.stringPostfix || (this.isPercent ? '%' : '');
	};

	this.stringValue = function() {
		return formatNumber(this.getBaseValue()) + this.getStringPostfix();
	};

	this.upgradeCost = function() {
		return Math.ceil(10 + 5 * this.level + 0.2 * Math.pow(this.level, 3.2)) +
			Player.statUpgradeBaseCost();
	};

	this.upgradeValue = function() {
		return this.getBaseValueAtLevel(this.level + 1) -
			this.getBaseValueAtLevel(this.level);
	};

	this.stringUpgradeValue = function() {
		return formatNumber(this.upgradeValue()) + this.getStringPostfix();
	};

	this.canUpgrade = function() {
		return this.isPlayerMinLevel() && Player.xp.amount >= this.upgradeCost();
	};

	this.tryUpgrade = function() {
		if (this.canUpgrade()) {
			Player.xp.amount -= this.upgradeCost();
			this.level++;

			this.onUpgrade();

			Player.updateStatButtons();
			return true;
		}
		return false;
	};

	this.isPlayerMinLevel = function() {
		return this.minLevel <= Player.getLevel();
	};

	this.getUpgradeButtonHtml = function() {
		var htmlStr = this.displayName + ': <span id="amount"></span>' +
			'<br/><span id="upgrade">(+<span id="upgrade-amount"></span>) : ' +
			'<span id="cost"></span> ' + getIconHtml('xp') + '</span>';
		return getButtonHtml("Player.upgrade('" + this.name + "')",
			htmlStr, 'stat-' + this.name + '-button');
	};

	this.updateButton = function() {
			var id = '#stat-' + this.name + '-button';
			j(id, 'toggle', this.canUpgrade());
			j(id + ' #upgrade', 'toggle', this.isPlayerMinLevel());
			j(id + ' #amount', 'text', this.stringValue());
			j(id + ' #upgrade-amount', 'text', this.stringUpgradeValue());
			j(id + ' #cost', 'text', formatNumber(this.upgradeCost()));
	};

	this.onUpgrade = data.onUpgrade || function() {};
}