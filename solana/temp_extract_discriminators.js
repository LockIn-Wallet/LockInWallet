const fs = require('fs');
const path = require('path');

// Read IDL file
const idlPath = process.argv[2];
const adapterPath = process.argv[3];

if (!fs.existsSync(idlPath)) {
    console.error('IDL file not found:', idlPath);
    process.exit(1);
}

if (!fs.existsSync(adapterPath)) {
    console.error('Adapter file not found:', adapterPath);
    process.exit(1);
}

const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
const discriminators = {};

// Extract discriminators from instructions
if (idl.instructions) {
    idl.instructions.forEach(instruction => {
        // Convert snake_case to PascalCase
        const methodName = instruction.name
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');

        if (instruction.discriminator) {
            discriminators[methodName] = instruction.discriminator;
        }
    });
}

console.log(`Found ${Object.keys(discriminators).length} discriminators:`);
Object.entries(discriminators).forEach(([name, disc]) => {
    console.log(`  ${name}: [${disc.join(', ')}]`);
});

// Read current adapter file
let adapterContent = fs.readFileSync(adapterPath, 'utf8');

// Build new discriminator object
const discriminatorEntries = Object.entries(discriminators)
    .map(([key, value]) => `      '${key}': [${value.join(', ')}]`)
    .join(',\n');

const newDiscriminatorBlock = `// Actual discriminators from anchor build IDL (auto-generated)
    const discriminators = {
${discriminatorEntries}
    };`;

// Find and replace the discriminator section
const discriminatorRegex = /(\/\/ .*discriminators.*\n\s*const discriminators = \{)([\s\S]*?)(\};)/;

if (discriminatorRegex.test(adapterContent)) {
    adapterContent = adapterContent.replace(discriminatorRegex, newDiscriminatorBlock);
    fs.writeFileSync(adapterPath, adapterContent);
    console.log('✅ SolanaAdapter updated with new discriminators');
} else {
    console.error('❌ Could not find discriminator section in SolanaAdapter');
    console.error('💡 Manual update may be required');
    process.exit(1);
}
