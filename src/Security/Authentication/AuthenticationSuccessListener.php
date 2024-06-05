<?php

declare(strict_types=1);

namespace App\Security\Authentication;

use App\Game\Context\PlayerContext;
use Lexik\Bundle\JWTAuthenticationBundle\Event\JWTCreatedEvent;
use Lexik\Bundle\JWTAuthenticationBundle\Events;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

#[AsEventListener(Events::JWT_CREATED)]
class AuthenticationSuccessListener
{
    public function __construct(
        private PlayerContext $playerContext
    ) {
    }

    public function __invoke(JWTCreatedEvent $event): void
    {
        $data = $event->getData();
        $user = $event->getUser();

        $data['data'] = [
            'pid' => $this->playerContext->getPlayer()->getUuid(),
        ];

        $event->setData($data);
    }
}
